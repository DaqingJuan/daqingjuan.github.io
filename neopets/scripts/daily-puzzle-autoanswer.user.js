// ==UserScript==
// @name         Neopets 每日謎題自動答
// @namespace    tony-neopets
// @version      1.0
// @description  在 Neopets Community Central 的 Daily Puzzle 區塊，自動向 Jellyneo 讀今天的答案、選對選項並送出。題目對不上就不送，避免答錯。
// @match        https://www.neopets.com/community/*
// @grant        GM_xmlhttpRequest
// @connect      www.jellyneo.net
// @connect      jellyneo.net
// @run-at       document-idle
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/daily-puzzle-autoanswer.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/daily-puzzle-autoanswer.user.js
// ==/UserScript==

(function () {
  'use strict';

  // 把題目文字整理成可比較的形式（小寫、去標點、去多餘空白）
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

  // ---------- 畫面上的小面板 ----------
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:99999;background:#fff8d6;border:2px solid #d9a400;' +
    'border-radius:10px;padding:8px 10px;font:13px/1.4 sans-serif;color:#333;max-width:260px;box-shadow:0 2px 8px #0004';
  panel.innerHTML =
    '<b>每日謎題小幫手 1.0</b><div id="dpz-msg" style="margin:4px 0">準備好了</div>' +
    '<button id="dpz-run" style="cursor:pointer">查答案並送出</button> ' +
    '<label style="font-size:12px"><input type="checkbox" id="dpz-auto"> 進頁面自動執行</label>';
  document.body.appendChild(panel);
  const msg = (t) => { document.getElementById('dpz-msg').textContent = t; };

  // ---------- 找 Neopets 的謎題表單 ----------
  function findForm() {
    const sel = document.querySelector('select[name="trivia_response"]');
    if (!sel) return null;
    const form = sel.closest('form');
    // 題目文字在表單前面最近的一段文字
    let q = '';
    let node = form;
    for (let i = 0; i < 6 && node && !q; i++) {
      let p = node.previousElementSibling;
      while (p && !q) {
        const t = (p.innerText || '').trim();
        if (t && t.length > 8 && t.length < 400 && !/Daily Puzzle/i.test(t)) q = t;
        p = p.previousElementSibling;
      }
      node = node.parentElement;
    }
    return { form, sel, question: q };
  }

  // ---------- 向 Jellyneo 讀答案 ----------
  function fetchJellyneo() {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://www.jellyneo.net/?go=dailypuzzle',
        onload: (r) => {
          try {
            const doc = new DOMParser().parseFromString(r.responseText, 'text/html');
            const ps = [...doc.querySelectorAll('p.text-center')];
            const qEl = ps.find((p) => /^\s*Question:/i.test(p.textContent));
            const aEl = ps.find((p) => /^\s*Answer:/i.test(p.textContent));
            const dEl = ps.find((p) => /Daily Puzzle answer for/i.test(p.textContent));
            if (!qEl || !aEl) return reject(new Error('Jellyneo 頁面格式變了，找不到答案'));
            resolve({
              question: qEl.textContent.replace(/^\s*Question:\s*/i, '').trim(),
              answer: aEl.textContent.replace(/^\s*Answer:\s*/i, '').trim(),
              date: dEl ? dEl.textContent.trim() : '',
            });
          } catch (e) { reject(e); }
        },
        onerror: () => reject(new Error('連不上 Jellyneo')),
        ontimeout: () => reject(new Error('Jellyneo 逾時')),
        timeout: 15000,
      });
    });
  }

  // ---------- 主流程 ----------
  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      const f = findForm();
      if (!f) { msg('找不到謎題表單（今天可能已經答過）'); return; }
      msg('向 Jellyneo 查答案中…');
      const j = await fetchJellyneo();

      // 題目對不上就不送（午夜時 Neopets 有時還顯示前一天的題目）
      const nq = norm(f.question), nj = norm(j.question);
      if (nq && nj && !(nq.includes(nj) || nj.includes(nq))) {
        msg('題目對不上，沒有送出。Neopets：「' + f.question.slice(0, 40) + '」 / Jellyneo：「' + j.question.slice(0, 40) + '」');
        return;
      }

      // 在下拉選單裡找文字相同的選項
      const want = norm(j.answer);
      const opt = [...f.sel.options].find((o) => o.value !== '0' && norm(o.textContent) === want);
      if (!opt) { msg('選項裡找不到答案「' + j.answer + '」，沒有送出'); return; }

      f.sel.value = opt.value;
      f.sel.dispatchEvent(new Event('change', { bubbles: true }));
      msg('答案：' + j.answer + '，送出中…');
      const btn = f.form.querySelector('input[type=submit],button[type=submit]');
      setTimeout(() => (btn ? btn.click() : f.form.submit()), 600);
    } catch (e) {
      msg('失敗：' + e.message);
    } finally {
      running = false;
    }
  }

  document.getElementById('dpz-run').addEventListener('click', run);
  const autoBox = document.getElementById('dpz-auto');
  try { autoBox.checked = localStorage.getItem('dpz_auto') === '1'; } catch (e) {}
  autoBox.addEventListener('change', () => {
    try { localStorage.setItem('dpz_auto', autoBox.checked ? '1' : '0'); } catch (e) {}
  });
  if (autoBox.checked && findForm()) setTimeout(run, 1500);
})();
