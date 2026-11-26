// ==UserScript==
// @name         Haggle Price Prefill
// @namespace    neopets-haggle-prefill
// @version      1.1
// @description  NPC shop haggle page: prefill the offer box with the asking price rounded down to the hundreds (87,333 -> 87,300). Never submits and never touches the captcha.
// @match        https://www.neopets.com/haggle.phtml*
// @grant        none
// @run-at       document-idle
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/haggle-prefill.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/haggle-prefill.user.js
// ==/UserScript==
//
// 用法：Tampermonkey → 新增腳本 → 整個貼上 → 存檔。
// 進到議價頁時，腳本會讀店主開的價，抹掉十位數跟個位數填進出價欄（87,333 → 87,300；低於 100 照原價）。
// 只會「填好」，不會按送出、不會碰人機驗證。驗證和送出都由你自己按。
// 如果店主回價（例如「不能低於 85,050」），重新載入的頁面會用新價格再填一次。

(function () {
  'use strict';

  function floorHundreds(n) {
    return n >= 100 ? Math.floor(n / 100) * 100 : n;
  }

  function findInput() {
    return document.querySelector('input[name="current_offer"]') ||
      [...document.querySelectorAll('form input[type="text"], form input[type="number"], form input:not([type])')]
        .find(i => i.offsetParent !== null);
  }

  // 只在店主說的話裡找價格，避開頁首的 NP 餘額
  function findAskingPrice(input) {
    const scopes = [];
    const said = [...document.querySelectorAll('p, div, td, span, b')]
      .filter(e => /shopkeeper|says|less than|want/i.test(e.textContent) && /Neopoints/i.test(e.textContent))
      .sort((a, b) => a.textContent.length - b.textContent.length);
    if (said[0]) scopes.push(said[0]);
    if (input && input.form) scopes.push(input.form.parentElement || input.form);
    for (const el of scopes) {
      const nums = [...el.textContent.matchAll(/([\d][\d,]*)\s*Neopoints/gi)]
        .map(m => parseInt(m[1].replace(/,/g, ''), 10))
        .filter(n => n > 0);
      if (nums.length) return nums[nums.length - 1]; // 最後一個 = 店主最新開價
    }
    return null;
  }

  function setValue(input, v) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function badge(input, price, offer) {
    const b = document.createElement('span');
    b.textContent = ' ← ' + price.toLocaleString() + ' → ' + offer.toLocaleString();
    b.style.cssText = 'margin-left:6px;padding:2px 6px;border-radius:4px;background:#2e7d32;color:#fff;font:bold 12px sans-serif;';
    input.insertAdjacentElement('afterend', b);
  }

  let tries = 0;
  (function start() {
    const input = findInput();
    const price = findAskingPrice(input);
    if ((!input || !price) && tries++ < 10) { setTimeout(start, 300); return; }
    // 頁面預設會放 0；只有你自己打了非 0 的數字才不蓋掉
    if (!input || !price || (input.value && input.value.trim() !== '0')) return;
    const offer = floorHundreds(price);
    setValue(input, offer);
    badge(input, price, offer);
  })();
})();
