// ==UserScript==
// @name         Neopets 填字自動填（Faerie Crossword Auto Fill）
// @namespace    neopets-crossword-autofill
// @version      1.0
// @description  妖精填字遊戲：自動到 Jellyneo 抓今天的答案，核對字數後一鍵全部填入（5 分鐘內完成拿 600 NP）
// @match        *://*.neopets.com/games/crossword/*
// @match        *://neopets.com/games/crossword/*
// @grant        GM_xmlhttpRequest
// @connect      www.jellyneo.net
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/crossword-autofill.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/crossword-autofill.user.js
// ==/UserScript==
//
// 用法：打開妖精填字遊戲，按「開始今天的題目」進到格子頁，右下角面板按「一鍵填完」。
// 答案來源：Jellyneo（https://www.jellyneo.net/?go=faerie_crossword），按下按鈕時才抓一次。
// 腳本會先核對每個答案的字數跟格子一樣長，不一樣就不填那一題，讓你自己看。

(() => {
  "use strict";
  if (window.__cwAuto) return;
  window.__cwAuto = true;

  const form = document.forms.clueform;
  if (!form) {
    // 還沒開始的頁面：只提示
    if (/Start Today|start today/i.test(document.body.textContent)) note("先按「Start Today's Puzzle!」開始，再用面板一鍵填完。");
    return;
  }

  // ---------- 讀格子與題目 ----------
  const cells = new Map(); // "r,c" -> 這格目前的字（空的是 ""）
  for (const a of document.querySelectorAll('a[onclick^="set_coords"]')) {
    const m = a.getAttribute("onclick").match(/\((\d+),\s*(\d+)\)/);
    // 空格的圖是 crossword/x.gif；填好的格子會換成別的圖或直接顯示字母
    const img = a.querySelector("img");
    const blank = img && /\/crossword\/x\.gif$/i.test(img.src);
    const txt = (a.closest("td") || a).textContent.trim();
    cells.set(m[1] + "," + m[2], blank ? "" : txt || (img ? "?" : ""));
  }
  const clues = [...document.querySelectorAll('a[onclick^="set_clue"]')].map((a) => {
    const [r, c, d, n] = a.getAttribute("onclick").match(/\(([^)]*)\)/)[1].split(",").map(Number);
    let len = 0, rr = r, cc = c, filled = true;
    while (cells.has(rr + "," + cc)) {
      if (!cells.get(rr + "," + cc)) filled = false;
      len++;
      d === 1 ? cc++ : rr++;
    }
    return { r, c, d, n, len, filled, text: a.textContent.trim() };
  });
  if (!clues.length) return;

  // ---------- 面板 ----------
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;background:#f3ecff;border:2px solid #8a5cd6;border-radius:12px;padding:10px 12px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 14px rgba(0,0,0,.2);display:grid;gap:6px;width:250px";
  box.innerHTML =
    '<b style="font-size:14px">填字自動填</b>' +
    '<button id="cw-go">一鍵填完</button>' +
    '<div id="cw-msg" style="font-size:12px;color:#444">按下去會到 Jellyneo 抓今天的答案再填入。</div>' +
    '<div id="cw-list" style="font-size:12px;max-height:220px;overflow:auto"></div>';
  document.body.appendChild(box);
  const btn = box.querySelector("#cw-go");
  btn.style.cssText = "font:inherit;padding:6px 8px;border-radius:8px;border:1px solid #6b3fb8;background:#c9b3f5;cursor:pointer";
  const msg = (t) => (box.querySelector("#cw-msg").textContent = t);
  const left = clues.filter((q) => !q.filled).length;
  msg(left ? `還有 ${left} 題沒填。按下去會到 Jellyneo 抓答案再填入。` : "全部格子都填好了。");

  // ---------- 抓答案 ----------
  function getHTML(url) {
    return new Promise((ok, bad) => {
      if (typeof GM_xmlhttpRequest === "function") {
        GM_xmlhttpRequest({ method: "GET", url, timeout: 20000, onload: (r) => ok(r.responseText), onerror: () => bad(new Error("連不到 Jellyneo")), ontimeout: () => bad(new Error("Jellyneo 逾時")) });
      } else fetch(url).then((r) => r.text()).then(ok, bad);
    });
  }
  function parseAnswers(html) {
    const d = new DOMParser().parseFromString(html, "text/html");
    const title = (d.querySelector(".panel h3") || {}).textContent || "";
    const out = { title: title.trim(), 1: {}, 2: {} };
    for (const h of d.querySelectorAll("h4")) {
      const dir = /across/i.test(h.textContent) ? 1 : /down/i.test(h.textContent) ? 2 : 0;
      const ol = h.nextElementSibling;
      if (!dir || !ol) continue;
      for (const li of ol.querySelectorAll("li")) out[dir][+li.getAttribute("value")] = li.textContent.trim().replace(/[^a-z]/gi, "").toUpperCase();
    }
    return out;
  }
  // 今天的 NST 日期（Neopets 用美西時間）
  const nstToday = () => new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles", month: "long", day: "numeric", year: "numeric" });

  // ---------- 送答案 ----------
  function body(q, word) {
    return new URLSearchParams({ x_word: word, showclue: q.n + (q.d === 1 ? " across" : " down"), x_clue_row: q.r, x_clue_col: q.c, x_clue_dir: q.d });
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  btn.onclick = async () => {
    btn.disabled = true;
    try {
      msg("到 Jellyneo 抓答案中…");
      const ans = parseAnswers(await getHTML("https://www.jellyneo.net/?go=faerie_crossword"));
      const today = nstToday();
      const dateOk = ans.title.includes(today);
      const list = [], bad = [];
      for (const q of clues) {
        const w = ans[q.d][q.n];
        const tag = (q.d === 1 ? "橫" : "直") + q.n;
        if (q.filled) continue;
        if (!w) bad.push(tag + "：找不到答案");
        else if (w.length !== q.len) bad.push(`${tag}：${w} 是 ${w.length} 個字，格子要 ${q.len} 個`);
        else list.push([q, w, tag]);
      }
      box.querySelector("#cw-list").innerHTML = list.map(([, w, t]) => `${t}　${w}`).concat(bad.map((b) => `<span style="color:#b00">${b}</span>`)).join("<br>");
      if (!dateOk && bad.length) {
        msg(`Jellyneo 目前是「${ans.title}」，不是今天（${today}）的答案，字數也對不上，先不填。晚點再試。`);
        btn.disabled = false;
        return;
      }
      if (!list.length) { msg(bad.length ? "沒有可以填的題目。" : "全部都填好了。"); btn.disabled = false; return; }
      // 前面幾題用背景送出，最後一題用正常送出，這樣會直接看到完成／獎勵畫面
      for (let i = 0; i < list.length - 1; i++) {
        const [q, w, t] = list[i];
        msg(`填入 ${t}：${w}（${i + 1}/${list.length}）`);
        await fetch(location.pathname, { method: "POST", body: body(q, w), credentials: "include" });
        await sleep(400 + Math.random() * 400);
      }
      const [q, w] = list[list.length - 1];
      msg("填最後一題，頁面會重新整理…");
      form.x_word.value = w;
      form.showclue.value = q.n + (q.d === 1 ? " across" : " down");
      form.x_clue_row.value = q.r;
      form.x_clue_col.value = q.c;
      form.x_clue_dir.value = q.d;
      form.submit();
    } catch (e) {
      msg("出錯：" + e.message);
      btn.disabled = false;
    }
  };

  function note(t) {
    const n = document.createElement("div");
    n.textContent = "填字自動填：" + t;
    n.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;background:#f3ecff;border:2px solid #8a5cd6;border-radius:12px;padding:8px 12px;font:13px sans-serif";
    document.body.appendChild(n);
  }
})();
