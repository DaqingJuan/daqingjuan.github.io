// ==UserScript==
// @name         NPC 商店行情標籤
// @namespace    neopets-npc-price-tag
// @version      1.5
// @description  在 NPC 商店、隱密塔、閣樓、交易站、圓頂屋車庫拍賣、二手店、Money Tree 等頁面，於物品圖片左上角顯示 itemdb 市價（資料來源 itemdb.com.br）
// @match        https://www.neopets.com/objects.phtml*
// @match        https://www.neopets.com/faerieland/hiddentower938.phtml*
// @match        https://www.neopets.com/halloween/garage.phtml*
// @match        https://www.neopets.com/island/tradingpost.phtml*
// @match        https://www.neopets.com/winter/igloo.phtml*
// @match        https://www.neopets.com/winter/igloo2.phtml*
// @match        https://www.neopets.com/thriftshoppe/*
// @match        https://www.neopets.com/donations.phtml*
// @match        https://www.neopets.com/inventory.phtml*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      itemdb.com.br
// @run-at       document-idle
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/npc-price-tag.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/npc-price-tag.user.js
// ==/UserScript==
//
// 用法：裝 Tampermonkey → 新增腳本 → 貼上整個檔案 → 存檔。
// 第一次用之前，先在同一個瀏覽器打開 https://itemdb.com.br 一次（通過 Cloudflare 驗證），
// itemdb 要求外掛腳本帶著它的登入狀態（cookie）才給查價；沒登入約 24 小時要再開一次，登入的話約 14 天。
//
// 標籤顏色（有標價的頁面：NPC 商店、隱密塔、閣樓、圓頂屋）：
//   綠色＝市價比標價高 1 萬 NP 以上（值得搶）
//   黃色＝市價比標價高，但不到 1 萬
//   灰色＝市價不比標價高，或查不到行情
// 沒有標價的頁面（交易站、二手店、Money Tree）：
//   綠色＝市價 10 萬以上　黃色＝1 萬～10 萬　灰色＝1 萬以下
// 滑鼠移到標籤上可以看到店價、市價、價差和稀有度。
//
// 只顯示資料，不會自動點擊或購買。每頁最多向 itemdb 查一次，查過的價格會暫存 6 小時。

(() => {
  "use strict";

  const PROFIT_GOOD = 10000;          // 價差達到這個數字就標綠色
  const CACHE_MS = 6 * 60 * 60 * 1000; // 價格暫存 6 小時
  const CACHE_KEY = "npt-cache-v1";

  // ---------- 小工具 ----------
  const zh = (n) =>
    n >= 1e8 ? (n / 1e8).toFixed(n >= 1e9 ? 0 : 1).replace(/\.0$/, "") + "億"
    : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "萬"
    : n.toLocaleString("en-US");
  const imgIdOf = (s) => {
    const m = String(s || "").match(/\/items\/([^/"')?]+?)\.(gif|png|jpg)/i);
    return m ? m[1] : null;
  };
  const num = (s) => +String(s || "0").replace(/[^\d]/g, "") || 0;

  // 圖片元素（img / input）本身不能放子元素，所以外面包一層定位用的 span
  function wrapImg(img) {
    if (img.parentElement.classList.contains("npt-wrap")) return img.parentElement;
    const w = document.createElement("span");
    w.className = "npt-wrap";
    img.parentNode.insertBefore(w, img);
    w.appendChild(img);
    return w;
  }

  // 各種商店頁面：找出每件商品的「標籤要貼的位置、名稱、圖片編號、店價」
  function collect() {
    // 背包：只補 Karla 價格腳本查不到（顯示「?」，例如放在交易站的物品）或沒有標價的格子
    if (/\/inventory\.phtml/.test(location.pathname)) {
      return [...document.querySelectorAll(".grid-item .item-img")].map((el) => {
        const kb = el.querySelector(".idb-price-badge");
        if (kb && kb.textContent.trim() !== "?") return null; // Karla 已經標好價格
        if (kb) kb.style.display = "none";
        return {
          el,
          name: (el.dataset.itemname || el.parentElement.querySelector(".item-name")?.textContent || "").trim(),
          img: imgIdOf(el.dataset.image || el.style.backgroundImage),
          shopPrice: 0,
          priced: false,
        };
      }).filter(Boolean);
    }

    // 一般 NPC 商店
    const shop = [...document.querySelectorAll(".shop-item .item-img")].map((el) => ({
      el,
      name: (el.dataset.name || el.closest(".shop-item")?.querySelector(".item-name")?.textContent || "").trim(),
      img: imgIdOf(el.style.backgroundImage),
      shopPrice: num(el.dataset.price),
    }));
    if (shop.length) return shop;

    // 幾乎廢棄的閣樓：li.attic-search-item（oname / oprice 屬性）
    const attic = [...document.querySelectorAll("li.attic-search-item")].map((li) => {
      const img = li.querySelector("img:not(.searchimg)");
      return img && {
        el: wrapImg(img),
        name: (li.getAttribute("oname") || li.querySelector("b")?.textContent || "").trim(),
        img: imgIdOf(img.src),
        shopPrice: num(li.getAttribute("oprice")),
      };
    }).filter(Boolean);
    if (attic.length) return attic;

    // 隱密塔：每格是 td > form > input[type=image]，名稱在 <b>，價格寫在「Cost : 3,000,000 NP」
    if (/hiddentower/.test(location.pathname)) {
      return [...document.querySelectorAll('input[type="image"]')].filter((i) => /\/items\//.test(i.src)).map((inp) => {
        const td = inp.closest("td");
        return td && {
          el: wrapImg(inp),
          name: (td.querySelector("b")?.textContent || "").trim(),
          img: imgIdOf(inp.src),
          shopPrice: num((td.innerText.match(/Cost\s*:\s*([\d,]+)/i) || [])[1]),
        };
      }).filter(Boolean);
    }

    // 其他頁面（交易站、圓頂屋車庫拍賣、二手店、Money Tree…）：通用找法
    return collectGeneric();
  }

  // 通用找法：頁面上每張物品圖（images.neopets.com/items/…），往外找「只包含這一張物品圖」的最大區塊，
  // 從區塊裡找物品名稱（data-item-name、alt、粗體字…）和標價（「1,234 NP」）
  const isItemImg = (el) => {
    if (el.closest(".npt-note, .search-helper") || el.classList.contains("searchimg")) return false;
    const src = el.tagName === "IMG" || el.tagName === "INPUT" ? el.src : el.style.backgroundImage;
    if (!/images\.neopets\.com\/items\//.test(src || "")) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 30 && r.height >= 30;
  };
  const badName = (t) => !t || t.length < 2 || t.length > 60 ||
    /\bNP\b|^\d[\d,\s]*$|in stock|\bCost\b|\bPrice\b|\bQty\b|\bQuantity\b|\bWishlist\b|^Lot\b|^x\d+$|donated by|owned by|^\(.*\)$/i.test(t);
  function nameIn(box, el) {
    const cands = [
      el.getAttribute("alt"), el.getAttribute("title"), el.dataset?.name, el.dataset?.itemName,
      box.querySelector("[data-item-name]")?.getAttribute("data-item-name"),
      box.querySelector("[data-name]")?.getAttribute("data-name"),
      box.getAttribute("oname"),
      ...[...box.querySelectorAll("b, strong, .item-name, [class*='name' i]")].map((e) => e.textContent),
      ...box.innerText.split("\n"),
    ];
    for (const c of cands) {
      const t = String(c || "").replace(/\s+/g, " ").trim();
      if (!badName(t)) return t;
    }
    return "";
  }
  function collectGeneric() {
    const els = [
      ...document.querySelectorAll("img, input[type='image']"),
      ...document.querySelectorAll("[style*='/items/']"),
    ].filter(isItemImg);
    const set = new Set(els);
    return els.map((el) => {
      // 找只含這一張物品圖的最大外框（最多往外 6 層）
      let box = el.parentElement;
      for (let k = 0; k < 6 && box.parentElement; k++) {
        const up = box.parentElement;
        const n = [...up.querySelectorAll("img, input[type='image'], [style*='/items/']")].filter((x) => set.has(x)).length;
        if (n > 1 || up === document.body) break;
        box = up;
      }
      const name = nameIn(box, el);
      const isBlock = el.tagName !== "IMG" && el.tagName !== "INPUT";
      return name && {
        el: isBlock ? el : wrapImg(el),
        name,
        img: imgIdOf(isBlock ? el.style.backgroundImage : el.src),
        shopPrice: num((box.innerText.match(/([\d,]{1,13})\s*NP\b/i) || [])[1]),
        priced: /\d\s*NP\b/i.test(box.innerText),
      };
    }).filter(Boolean);
  }
  const loadCache = () => { try { return JSON.parse(GM_getValue(CACHE_KEY, "{}")); } catch { return {}; } };
  const saveCache = (c) => { try { GM_setValue(CACHE_KEY, JSON.stringify(c)); } catch {} };

  function post(url, body) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        data: JSON.stringify(body),
        withCredentials: true,
        anonymous: false,
        timeout: 15000,
        onload: (r) => {
          let json = null;
          try { json = JSON.parse(r.responseText); } catch {}
          resolve({ status: r.status, json });
        },
        onerror: () => resolve({ status: 0, json: null }),
        ontimeout: () => resolve({ status: 0, json: null }),
      });
    });
  }

  // itemdb 回傳的格式可能是 { key: item } 或 [item, ...]，兩種都接受
  const itemsOf = (json) => (!json ? [] : Array.isArray(json) ? json : Object.values(json)).filter((x) => x && typeof x === "object" && x.name);
  const priceOf = (it) => (it.price && typeof it.price === "object" ? it.price.value : it.price) ?? null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // 一次最多查 100 件；超過就分批，每批之間停 1.5 秒（不要狂查 itemdb）
  async function lookup(list) {
    let all = {}, last = { status: 200, json: {} };
    for (let i = 0; i < list.length; i += 100) {
      if (i) await sleep(1500);
      last = await lookupChunk(list.slice(i, i + 100));
      if (last.status !== 200) return last;
      const items = itemsOf(last.json);
      items.forEach((it, k) => (all[i + "_" + k] = it));
    }
    return { status: 200, json: all };
  }

  async function lookupChunk(list) {
    // list: [{ name, img }]
    // 1) v2：用「名稱 + 圖片編號」查，最準（同名不同物品也分得開）
    let r = await post("https://itemdb.com.br/api/v2/items/many", {
      type: "name_image_id",
      data: list.map((x) => [x.name, x.img]),
      intent: "pricer",
    });
    // 2) 不行的話退回舊版用名稱查
    if (r.status !== 200 || !itemsOf(r.json).length) {
      const r1 = await post("https://itemdb.com.br/api/v1/items/many", { name: list.map((x) => x.name) });
      if (r1.status === 200 && itemsOf(r1.json).length) r = r1;
    }
    return r;
  }

  // ---------- 畫面 ----------
  const css = document.createElement("style");
  css.textContent = `
    .npt-host { position: relative; }
    .npt-wrap { position: relative; display: inline-block; line-height: 0; }
    .npt-tag { position: absolute; top: 2px; left: 2px; z-index: 5; pointer-events: auto;
      font: 700 11px/1.25 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif;
      padding: 2px 5px; border-radius: 6px; color: #fff; background: rgba(90,90,90,.85);
      box-shadow: 0 1px 3px rgba(0,0,0,.35); white-space: nowrap; letter-spacing: .2px; }
    .npt-tag.good { background: #1f9d55; }
    .npt-tag.ok   { background: #c98a12; }
    .npt-tag.none { background: rgba(120,120,120,.75); font-weight: 400; }
    .npt-note { position: fixed; right: 12px; bottom: 12px; z-index: 99999; max-width: 300px;
      font: 13px/1.45 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; color: #222;
      background: #fff8e6; border: 2px solid #e8a31b; border-radius: 10px; padding: 8px 10px;
      box-shadow: 0 4px 14px rgba(0,0,0,.2); }
    .npt-note a { color: #0b62c4; font-weight: 700; }
    .npt-note button { margin-left: 6px; font: inherit; border: 0; background: none; cursor: pointer; color: #888; }
  `;
  document.head.appendChild(css);

  function note(html) {
    document.querySelector(".npt-note")?.remove();
    const d = document.createElement("div");
    d.className = "npt-note";
    d.innerHTML = html + '<button type="button" aria-label="關閉">✕</button>';
    d.querySelector("button").onclick = () => d.remove();
    document.body.appendChild(d);
  }

  function paint(cells, cache) {
    for (const c of cells) {
      const hit = cache[c.key];
      c.el.querySelector(".npt-tag")?.remove();
      if (!hit) continue;
      const tag = document.createElement("span");
      tag.className = "npt-tag";
      if (hit.v == null) {
        tag.classList.add("none");
        tag.textContent = "無行情";
        tag.title = `${c.name}\nitemdb 沒有市價資料`;
      } else if (c.priced === false || (c.priced === undefined && !c.shopPrice)) {
        // 沒有標價的頁面：直接看市價高低
        tag.classList.add(hit.v >= 100000 ? "good" : hit.v >= 10000 ? "ok" : "none");
        tag.textContent = zh(hit.v);
        tag.title = `${c.name}\n市價約 ${hit.v.toLocaleString("en-US")} NP` + (hit.r ? `\n稀有度 r${hit.r}` : "") + "\n資料來源 itemdb.com.br";
      } else {
        const gain = hit.v - c.shopPrice;
        tag.classList.add(gain >= PROFIT_GOOD ? "good" : gain > 0 ? "ok" : "none");
        tag.textContent = zh(hit.v);
        tag.title = `${c.name}\n市價約 ${hit.v.toLocaleString("en-US")} NP\n店價 ${c.shopPrice.toLocaleString("en-US")} NP\n價差 ${gain >= 0 ? "+" : ""}${gain.toLocaleString("en-US")} NP` +
          (hit.r ? `\n稀有度 r${hit.r}` : "") + "\n資料來源 itemdb.com.br";
      }
      c.el.classList.add("npt-host");
      c.el.appendChild(tag);
    }
  }

  let running = false;
  async function run() {
    if (running) return;
    const found = collect().filter((c) => c.name);
    if (!found.length) return;
    running = true;
    try { await work(found); } finally { running = false; }
  }

  async function work(found) {
    const cells = found.map((c) => ({ ...c, key: c.name + "|" + (c.img || "") }));

    // Neopets 網站語言不是英文時，商品名稱會變成中文或「????」，itemdb 對不上
    if (cells.filter((c) => /\?\?|[^\x00-\x7F]/.test(c.name)).length > cells.length / 2) {
      note('商品名稱不是英文，查不到行情。請把 Neopets 網站語言改成 <b>English</b>（網頁最下面的語言選單），再重新整理。');
      return;
    }

    const cache = loadCache();
    const now = Date.now();
    for (const k in cache) if (now - cache[k].t > CACHE_MS) delete cache[k];
    paint(cells, cache);

    const need = [];
    const seen = new Set();
    for (const c of cells) if (!cache[c.key] && !seen.has(c.key)) { seen.add(c.key); need.push(c); }

    if (need.length) {
      const r = await lookup(need.map((c) => ({ name: c.name, img: c.img })));
      if (r.status === 401 || r.status === 403) {
        note('查不到行情：itemdb 需要先驗證。請先打開 <a href="https://itemdb.com.br" target="_blank" rel="noopener">itemdb.com.br</a> 一次，通過驗證後再重新整理這頁。');
      } else if (r.status === 429) {
        note("itemdb 暫時限制查詢次數（查太頻繁），等幾分鐘再重新整理。");
      } else if (r.status !== 200) {
        note(`查行情失敗（狀態碼 ${r.status || "連不上"}）。可以先打開 <a href="https://itemdb.com.br" target="_blank" rel="noopener">itemdb.com.br</a> 看看是否正常。`);
      } else {
        const items = itemsOf(r.json);
        const byKey = new Map();
        for (const it of items) {
          const img = it.image?.id || (String(it.image?.url || it.image || "").match(/\/items\/([^/]+?)\.(gif|png|jpg)/i) || [])[1] || "";
          const val = { v: priceOf(it), r: it.rarity ?? null, t: now };
          byKey.set(it.name + "|" + img, val);
          if (!byKey.has(it.name + "|")) byKey.set(it.name + "|", val);
        }
        for (const c of need) {
          cache[c.key] = byKey.get(c.key) || byKey.get(c.name + "|") || { v: null, r: null, t: now };
        }
        saveCache(cache);
        paint(cells, cache);
      }
    }
  }

  // 商店頁有時候會晚一點才把商品畫出來：最多等 10 秒，等到商品出現再跑；
  // 之後商品列表換新（只看列表本身，不看標籤），再跑一次
  let tries = 0;
  (function start() {
    if (/\/inventory\.phtml/.test(location.pathname) && tries++ < 6) { setTimeout(start, 500); return; } // 先等 Karla 的價格腳本跑完
    if (!collect().length && ++tries < 20) { setTimeout(start, 500); return; }
    run();
    // 交易站等頁面會動態換內容（切換分頁、翻頁），有新的東西出現就再跑一次；自己加的標籤不算
    const ours = (n) => n.nodeType !== 1 || n.matches(".npt-tag, .npt-wrap, .npt-note") || n.closest(".npt-note");
    let timer = null;
    new MutationObserver((muts) => {
      if (!muts.some((m) => [...m.addedNodes].some((n) => !ours(n)))) return;
      clearTimeout(timer); timer = setTimeout(run, 600);
    }).observe(document.body, { childList: true, subtree: true });
    // 切換分頁時物品可能只是從隱藏變成顯示（沒有新增東西），所以點擊後也再檢查一次
    document.addEventListener("click", (e) => {
      if (e.target.closest?.(".npt-tag, .npt-note")) return;
      clearTimeout(timer); timer = setTimeout(run, 800);
    }, true);
  })();
})();
