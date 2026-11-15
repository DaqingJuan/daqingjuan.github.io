// ==UserScript==
// @name         超神奇商店精靈
// @namespace    tony-neopets
// @version      1.0
// @description  在 Shop Wizard 頁面加一個面板：對同一個物品連續查幾輪（等於你自己按 Resubmit 好幾次），把每輪看到的賣家合併、依價格排序，標出相對便宜的。購買仍由你手動點連結，腳本不會自動買。
// @match        https://www.neopets.com/shops/wizard.phtml*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/super-shop-wizard.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/super-shop-wizard.user.js
// ==/UserScript==

(function () {
  'use strict';

  const ENDPOINT = '/np-templates/ajax/wizard.php';
  const MAX_ROUNDS = 20;        // 一次最多查幾輪
  const MIN_DELAY = 1800;       // 每輪之間最少等待（毫秒），別太快
  const MAX_DELAY = 3200;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fmt = (n) => n.toLocaleString('en-US');
  const median = (arr) => {
    const a = [...arr].sort((x, y) => x - y);
    if (!a.length) return 0;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  // ---------- 面板 ----------
  const box = document.createElement('div');
  box.style.cssText =
    'position:fixed;right:10px;top:70px;z-index:99999;width:380px;max-height:80vh;overflow:auto;' +
    'background:#fff;border:2px solid #3b6fb6;border-radius:10px;padding:10px;font:13px/1.45 sans-serif;color:#222;box-shadow:0 3px 12px #0005';
  box.innerHTML =
    '<div style="font-weight:bold;font-size:14px">超神奇商店精靈 1.0</div>' +
    '<div style="margin:6px 0">物品名稱：<input id="ssw-name" style="width:230px"></div>' +
    '<div style="margin:6px 0">比對：<select id="ssw-crit"><option value="exact">完全相同</option><option value="containing">包含</option></select> ' +
    '輪數：<input id="ssw-rounds" type="number" min="1" max="' + MAX_ROUNDS + '" value="8" style="width:44px"></div>' +
    '<div style="margin:6px 0">價格上限：<input id="ssw-max" type="number" value="999999" style="width:90px"> ' +
    '參考價：<input id="ssw-ref" type="number" placeholder="選填" style="width:80px"></div>' +
    '<button id="ssw-go" style="cursor:pointer">開始查</button> <button id="ssw-stop" style="cursor:pointer" disabled>停止</button>' +
    '<div id="ssw-status" style="margin:6px 0;color:#555">就緒</div>' +
    '<div id="ssw-result"></div>';
  document.body.appendChild(box);
  const $ = (id) => document.getElementById(id);

  // 預設帶入頁面搜尋框已輸入的文字
  const pageInput = document.querySelector('#shopwizard, input[name=shopwizard]');
  if (pageInput && pageInput.value) $('ssw-name').value = pageInput.value;

  let stopFlag = false;
  const seen = new Map(); // key -> {owner, price, stock, href}

  async function queryOnce(name, crit, maxPrice) {
    const body = new URLSearchParams({
      type: 'process_wizard',
      feedset: '0',
      shopwizard: name,
      table: '',
      criteria: crit,
      min_price: '1',
      max_price: String(maxPrice),
    });
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
      body,
    });
    const text = await r.text();
    if (/Request denied/i.test(text)) throw new Error('伺服器拒絕請求（可能太頻繁或登出了）');
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const rows = [];
    doc.querySelectorAll('a[href*="browseshop"]').forEach((a) => {
      const li = a.closest('li');
      if (!li) return;
      const priceEl = li.querySelector('.wizard-results-price');
      const price = priceEl ? parseInt(priceEl.textContent.replace(/[^\d]/g, ''), 10) : NaN;
      if (!price) return;
      const stockEl = li.querySelector('p');
      const stock = stockEl ? parseInt(stockEl.textContent.replace(/[^\d]/g, ''), 10) || 1 : 1;
      rows.push({ owner: a.textContent.trim(), price, stock, href: a.getAttribute('href') });
    });
    return rows;
  }

  function render() {
    const list = [...seen.values()].sort((a, b) => a.price - b.price);
    if (!list.length) { $('ssw-result').innerHTML = ''; return; }
    const med = median(list.map((x) => x.price));
    const ref = parseInt($('ssw-ref').value, 10) || 0;
    const base = ref || med;
    let html =
      '<div style="margin:4px 0">共 <b>' + list.length + '</b> 家，最低 <b>' + fmt(list[0].price) +
      '</b>，中位數 ' + fmt(med) + (ref ? '，你的參考價 ' + fmt(ref) : '') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#eef3fb"><th align="left">賣家</th><th>庫存</th><th align="right">價格</th><th></th></tr>';
    list.slice(0, 40).forEach((x, i) => {
      const ratio = x.price / base;
      const tag = ratio <= 0.5 ? '🔥很低' : ratio <= 0.8 ? '👍偏低' : '';
      const bg = ratio <= 0.5 ? '#fff0d8' : ratio <= 0.8 ? '#f1fbe9' : '#fff';
      html +=
        '<tr style="background:' + bg + '"><td>' + x.owner + '</td><td align="center">' + x.stock +
        '</td><td align="right">' + fmt(x.price) + '</td><td>' +
        '<a href="' + x.href + '" target="_blank" rel="noopener">開店</a> ' + tag + '</td></tr>';
    });
    html += '</table><div style="color:#777;font-size:11px;margin-top:4px">「偏低」＝低於基準 80%，「很低」＝低於 50%（基準是你填的參考價，沒填就用中位數）。點「開店」自己確認品名和價格再買。</div>';
    $('ssw-result').innerHTML = html;
  }

  async function run() {
    const name = $('ssw-name').value.trim();
    if (!name) { $('ssw-status').textContent = '請先輸入物品名稱'; return; }
    const crit = $('ssw-crit').value;
    const rounds = Math.max(1, Math.min(MAX_ROUNDS, parseInt($('ssw-rounds').value, 10) || 8));
    const maxPrice = parseInt($('ssw-max').value, 10) || 999999;
    seen.clear();
    stopFlag = false;
    $('ssw-go').disabled = true;
    $('ssw-stop').disabled = false;
    try {
      for (let i = 1; i <= rounds && !stopFlag; i++) {
        $('ssw-status').textContent = '第 ' + i + '/' + rounds + ' 輪查詢中…';
        const rows = await queryOnce(name, crit, maxPrice);
        let added = 0;
        rows.forEach((x) => {
          const key = x.owner + '|' + x.price;
          if (!seen.has(key)) { seen.set(key, x); added++; }
        });
        render();
        $('ssw-status').textContent = '第 ' + i + '/' + rounds + ' 輪完成，新增 ' + added + ' 家';
        // 連續兩輪都沒有新賣家，代表大概查完了
        if (i >= 3 && added === 0 && rows.length < 20) { $('ssw-status').textContent += '（已無新賣家，提前結束）'; break; }
        if (i < rounds && !stopFlag) await sleep(MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY));
      }
      if (!seen.size) $('ssw-status').textContent = '沒有找到賣家（可能沒人賣，或名稱拼錯）';
      else if (stopFlag) $('ssw-status').textContent += '（已手動停止）';
    } catch (e) {
      $('ssw-status').textContent = '失敗：' + e.message;
    } finally {
      $('ssw-go').disabled = false;
      $('ssw-stop').disabled = true;
    }
  }

  $('ssw-go').addEventListener('click', run);
  $('ssw-stop').addEventListener('click', () => { stopFlag = true; });
  $('ssw-ref').addEventListener('input', render);
  $('ssw-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
})();
