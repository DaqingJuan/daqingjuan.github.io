// ==UserScript==
// @name         NPC 商店行情標籤
// @namespace    neopets-npc-price-tag
// @version      2.6
// @description  在 NPC 商店、隱密塔、閣樓、交易站、拍賣場、圓頂屋車庫拍賣、二手店、Money Tree 等頁面，以及廚房／雪精靈／食人樹／Jhudora 任務頁，於物品圖片左上角顯示 itemdb 市價（資料來源 itemdb.com.br）
// @match        https://www.neopets.com/objects.phtml*
// @match        https://www.neopets.com/faerieland/hiddentower938.phtml*
// @match        https://www.neopets.com/halloween/garage.phtml*
// @match        https://www.neopets.com/island/tradingpost.phtml*
// @match        https://www.neopets.com/winter/igloo.phtml*
// @match        https://www.neopets.com/winter/igloo2.phtml*
// @match        https://www.neopets.com/thriftshoppe/*
// @match        https://www.neopets.com/donations.phtml*
// @match        https://www.neopets.com/inventory.phtml*
// @match        https://www.neopets.com/auctions.phtml*
// @match        https://www.neopets.com/genie.phtml*
// @match        https://www.neopets.com/island/kitchen.phtml*
// @match        https://www.neopets.com/winter/snowfaerie.phtml*
// @match        https://www.neopets.com/halloween/esophagor.phtml*
// @match        https://www.neopets.com/halloween/witchtower.phtml*
// @match        https://www.neopets.com/space/coincidence.phtml*
// @match        https://www.neopets.com/medieval/earthfaerie.phtml*
// @match        https://www.neopets.com/faerieland/darkfaerie.phtml*
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
//   紅色＝市價比標價高 5 萬 NP 以上（很可以買）
//   綠色＝市價比標價高 1 萬 NP 以上（值得搶）
//   黃色＝市價比標價高，但不到 1 萬
//   灰色＝市價不比標價高，或查不到行情
// 沒有標價的頁面（交易站、二手店、Money Tree）：
//   綠色＝市價 10 萬以上　黃色＝1 萬～10 萬　灰色＝1 萬以下
// 滑鼠移到標籤上可以看到店價、市價、價差和稀有度。
//
// v2.6：左下角清單每件加上好賣／普通／難賣標籤，以及 🔗 查價（itemdb）、🔗 商店精靈連結。
// v2.5：NPC 商店商品名稱下面標「好賣／普通／難賣」；利潤 5 萬以上用紅色標「很可以買」。
// v2.4：NPC 商店左下角列出「利潤 ≥ 1 萬」的商品（由高到低），按「去買」會捲到該商品並打開 Neopets 的購買確認視窗，
// 確認、驗證、出價都由你自己按。
// 只顯示資料，不會自動購買或送出。每頁最多向 itemdb 查一次，查過的價格會暫存 6 小時。

(() => {
  "use strict";

  const PROFIT_GOOD = 10000;          // 價差達到這個數字就標綠色
  const PROFIT_HOT = 50000;           // 價差達到這個數字就標紅色（很可以買）
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


  // ---------- 任務頁（廚房、雪精靈、食人樹、Jhudora）：物品要什麼就顯示那個物品的市價 ----------
  const QUEST_PATH = /\/(island\/kitchen|winter\/snowfaerie|halloween\/esophagor|halloween\/witchtower|space\/coincidence|medieval\/earthfaerie|faerieland\/darkfaerie)\.phtml/;
  // quest item name: prefer <p>, drop icons/symbols (e.g. the swap arrow on Esophagor items) that are not plain English
  const questName = (d) => {
    const c = d.cloneNode(true);
    c.querySelectorAll(".npt-tag, .npt-note").forEach((x) => x.remove()); // our own price tags must not become part of the name
    return (c.querySelector("p")?.textContent || c.textContent).replace(/[^\x20-\x7E]+/g, " ").replace(/\s+/g, " ").trim();
  };
  function collectQuest() {
    if (!QUEST_PATH.test(location.pathname)) return null;
    const out = [];
    // 廚房、雪精靈：.ingredient-grid 裡每格 = 圖片 + 名稱文字
    document.querySelectorAll(".ingredient-grid > div").forEach((d) => {
      const img = d.querySelector("img");
      if (!img) return;
      out.push({ el: wrapImg(img), name: questName(d), img: imgIdOf(img.src), shopPrice: 0, priced: false, quest: true });
    });
    // Jhudora：名稱在「Where is my XXX?」這句話裡，圖片是旁邊那一張物品圖
    if (/darkfaerie/.test(location.pathname)) {
      const m = document.body.innerText.match(/Where is my (.+?)\?/);
      const img = m && [...document.querySelectorAll("img")].find((i) =>
        /images\.neopets\.com\/items\//.test(i.src) && !i.closest(".sh-dock, .sh-tile, .npt-note, .search-helper") && i.getBoundingClientRect().width >= 30);
      if (img) out.push({ el: wrapImg(img), name: m[1].trim(), img: imgIdOf(img.src), shopPrice: 0, priced: false, quest: true });
    }
    // 其他任務頁（太空船 Coincidence 等）：物品不一定在 .ingredient-grid 裡，改用通用找法，並在每樣物品下面補上查價連結
    if (!out.length && !/darkfaerie/.test(location.pathname)) {
      for (const c of collectGeneric()) {
        if (!c.name) continue;
        out.push({ ...c, shopPrice: 0, priced: false, quest: true });
        addQuestLinks(c.el, c.name);
      }
    }
    return out;
  }
  // 在任務物品下面補：商店精靈、保險箱、查價（itemdb）連結
  function addQuestLinks(wrap, name) {
    const host = wrap.parentElement;
    if (!host || host.querySelector(".npt-links")) return;
    if (host.querySelectorAll("img").length > 2) return; // already has Neopets' own Search Helper icons (Shop Wizard, SDB...)
    const q = encodeURIComponent(name);
    const d = document.createElement("div");
    d.className = "npt-links";
    d.innerHTML = '<a href="/shops/wizard.phtml?string=' + q + '" target="_blank" rel="noopener">商店精靈</a> · ' +
      '<a href="/safetydeposit.phtml?obj_name=' + q + '&category=0" target="_blank" rel="noopener">保險箱</a> · ' +
      '<a href="https://itemdb.com.br/search?s=' + q + '" target="_blank" rel="noopener">查價</a>';
    host.appendChild(d);
  }

  // 任務頁右下角摘要：材料市價合計（綠＝1 萬內、黃＝5 萬內、紅＝超過 5 萬）
  function questSummary(cells, cache) {
    if (!cells.length || !cells[0].quest) return;
    const seenK = new Set();
    let total = 0, unknown = 0;
    const lines = [];
    for (const c of cells) {
      if (seenK.has(c.key)) continue;
      seenK.add(c.key);
      const hit = cache[c.key];
      if (!hit) continue;
      if (hit.v == null) { unknown++; lines.push(`${c.name}：無行情`); }
      else { total += hit.v; lines.push(`${c.name}：${hit.v.toLocaleString("en-US")}`); }
    }
    if (!lines.length) return;
    const color = total <= 10000 ? "#1f9d55" : total <= 50000 ? "#c98a12" : "#c0392b";
    note(`<div style="font-weight:700">任務材料市價合計 <span style="color:${color}">${total.toLocaleString("en-US")} NP</span>${unknown ? `（另有 ${unknown} 樣無行情）` : ""}</div>` +
      `<div style="font-size:12px;color:#555;margin-top:3px">${lines.join("<br>")}</div>` +
      `<div style="font-size:11px;color:#888;margin-top:3px">市價是 itemdb 的參考價，實際買價以商店精靈為準</div>`);
  }

  // 各種商店頁面：找出每件商品的「標籤要貼的位置、名稱、圖片編號、店價」
  function collect() {
    const quest = collectQuest();
    if (quest) return quest;
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

    // 拍賣場（列表和拍賣精靈搜尋結果）：每列一張 img.ah2_thumb，用「Current Price / 目前價格」那欄當標價
    const aucImgs = [...document.querySelectorAll("img.ah2_thumb")].filter((i) => /\/items\//.test(i.src));
    if (aucImgs.length) {
      return aucImgs.map((img) => {
        const tr = img.closest("tr");
        if (!tr) return null;
        // 找「Current Price」在第幾欄（標題「Item」橫跨圖片＋名稱兩欄，要把 colspan 算進去）
        const headRow = [...(tr.closest("table")?.rows || [])].find((r) => /Current Price/i.test(r.innerText));
        let pi = 6;
        if (headRow) {
          let col = 0;
          for (const h of headRow.cells) { if (/Current Price/i.test(h.innerText)) { pi = col; break; } col += h.colSpan || 1; }
        }
        const priceCell = tr.cells[pi] || [...tr.cells].reverse().find((c) => /\d\s*NP/.test(c.innerText));
        return {
          el: wrapImg(img),
          name: (tr.querySelector("[data-item-name]")?.getAttribute("data-item-name") || tr.cells[2]?.querySelector("a")?.textContent || "").trim(),
          img: imgIdOf(img.src),
          shopPrice: num((priceCell?.innerText.match(/([\d,]+)\s*NP/) || [])[1]),
          priced: true,
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
    /^item image$|\bNP\b|^\d[\d,\s]*$|in stock|\bCost\b|\bPrice\b|\bQty\b|\bQuantity\b|\bWishlist\b|^Lot\b|^x\d+$|donated by|owned by|^\(.*\)$/i.test(t);
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
    .npt-tag.bad  { background: #c0392b; }
    .npt-tag.quest { font-size: 11px; line-height: 1.15; padding: 1px 4px; top: -3px; left: -3px; border-radius: 5px; }
    .npt-tag.none { background: rgba(120,120,120,.75); font-weight: 400; }
    .npt-sale { position: absolute; bottom: 2px; right: 2px; z-index: 5; pointer-events: auto;
      font: 700 9px/1.1 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif;
      padding: 0 3px; border-radius: 5px; border: 1px solid; white-space: nowrap;
      background: rgba(20,28,40,.88); box-shadow: 0 1px 3px rgba(0,0,0,.35); }
    .npt-sale.ets { color: #5fd08f; border-color: #3fb56f; }
    .npt-sale.regular { color: #f2d04a; border-color: #d9b52f; }
    .npt-sale.hts { color: #ff7b7b; border-color: #e65a5a; }
    .npt-sale.quest { bottom: -3px; right: -3px; }
    .npt-note { position: fixed; right: 12px; bottom: 12px; z-index: 99999; max-width: 300px;
      font: 13px/1.45 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; color: #222;
      background: #fff8e6; border: 2px solid #e8a31b; border-radius: 10px; padding: 8px 10px;
      box-shadow: 0 4px 14px rgba(0,0,0,.2); }
    .npt-note a { color: #0b62c4; font-weight: 700; }
    .npt-links { font-size: 11px; line-height: 1.4; margin-top: 2px; text-align: center; }
    .npt-links a { color: #0b62c4; text-decoration: underline; }
    .npt-note button { margin-left: 6px; font: inherit; border: 0; background: none; cursor: pointer; color: #888; }
    .npt-tag.hot  { background: #d62828; font-size: 12px; box-shadow: 0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,.4); }
    .npt-sale-txt { display: inline-block; margin: 2px auto 0; padding: 0 6px; border-radius: 8px; border: 1px solid;
      font: 700 11px/1.5 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; }
    .npt-sale-txt.ets { color: #17824a; border-color: #3fb56f; background: #e6f6ec; }
    .npt-sale-txt.regular { color: #8a6a00; border-color: #d9b52f; background: #fff7d6; }
    .npt-sale-txt.hts { color: #b42323; border-color: #e65a5a; background: #fdeaea; }
    .npt-deal-hl { outline: 4px solid #1f9d55 !important; outline-offset: 2px; border-radius: 6px; }
    .npt-deal-hl.npt-deal-hot { outline-color: #d62828 !important; outline-width: 5px; }
    .npt-deals .row.hot .nm, .npt-deals .row.hot .gain { color: #d62828; }
    .npt-deals .hot-badge { display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 6px; background: #d62828; color: #fff; font-size: 11px; }
    .npt-deals .row.hot .go { background: #d62828; }
    .npt-deal-flash { animation: nptFlash 1s ease-in-out 3; }
    @keyframes nptFlash { 50% { outline-color: #ffd54f; } }
    .npt-deals { position: fixed; left: 12px; bottom: 12px; z-index: 99999; width: 300px; max-height: 60vh; overflow: auto;
      font: 13px/1.4 -apple-system, "PingFang TC", "Microsoft JhengHei", sans-serif; color: #222;
      background: #effaf3; border: 2px solid #1f9d55; border-radius: 10px; padding: 8px 10px; box-shadow: 0 4px 14px rgba(0,0,0,.2); }
    .npt-deals h4 { margin: 0 0 6px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
    .npt-deals h4 button { border: 0; background: none; cursor: pointer; color: #888; font: inherit; }
    .npt-deals .row { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid #cfe9d9; }
    .npt-deals .row:first-of-type { border-top: 0; }
    .npt-deals .info { flex: 1; min-width: 0; }
    .npt-deals .nmrow { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .npt-deals .nm { font-weight: 700; }
    .npt-deals .sub { font-size: 11.5px; color: #555; }
    .npt-deals .meta { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; margin-top: 3px; font-size: 11.5px; }
    .npt-deals .meta .npt-sale-txt { margin: 0; }
    .npt-deals .meta a { color: #0b62c4; text-decoration: none; white-space: nowrap; }
    .npt-deals .meta a:hover { text-decoration: underline; }
    .npt-deals .gain { color: #1f9d55; font-weight: 700; }
    .npt-deals .go { flex: none; border: 0; border-radius: 6px; padding: 5px 9px; background: #1f9d55; color: #fff; font: 700 12px sans-serif; cursor: pointer; }
    .npt-deals .go:hover { background: #17824a; }
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
      c.el.querySelector(".npt-sale")?.remove();
      if (!hit) continue;
      const tag = document.createElement("span");
      tag.className = "npt-tag";
      if (hit.v == null) {
        tag.classList.add("none");
        tag.textContent = "無行情";
        tag.title = `${c.name}\nitemdb 沒有市價資料`;
      } else if (c.quest) {
        tag.classList.add("quest", hit.v <= 10000 ? "good" : hit.v <= 50000 ? "ok" : "bad");
        tag.textContent = hit.v.toLocaleString("en-US");
        tag.title = `${c.name}\nQ: ${hit.v.toLocaleString("en-US")} NP` + (hit.r ? `\nr${hit.r}` : "") + "\nitemdb.com.br";
      } else if (c.priced === false || (c.priced === undefined && !c.shopPrice)) {
        // 沒有標價的頁面：直接看市價高低
        tag.classList.add(hit.v >= 100000 ? "good" : hit.v >= 10000 ? "ok" : "none");
        tag.textContent = zh(hit.v);
        tag.title = `${c.name}\n市價約 ${hit.v.toLocaleString("en-US")} NP` + (hit.r ? `\n稀有度 r${hit.r}` : "") + "\n資料來源 itemdb.com.br";
      } else {
        const gain = hit.v - c.shopPrice;
        tag.classList.add(gain >= PROFIT_HOT ? "hot" : gain >= PROFIT_GOOD ? "good" : gain > 0 ? "ok" : "none");
        tag.textContent = zh(hit.v);
        tag.title = `${c.name}\n市價約 ${hit.v.toLocaleString("en-US")} NP\n店價 ${c.shopPrice.toLocaleString("en-US")} NP\n價差 ${gain >= 0 ? "+" : ""}${gain.toLocaleString("en-US")} NP` +
          (hit.r ? `\n稀有度 r${hit.r}` : "") + "\n資料來源 itemdb.com.br";
      }
      c.el.classList.add("npt-host");
      c.el.appendChild(tag);
      const SALE = { ets: ["\u597d\u8ce3", "Easy to Sell"], regular: ["\u666e\u901a", "Regular"], hts: ["\u96e3\u8ce3", "Hard to Sell"] };
      if (hit.s && SALE[hit.s]) {
        const sb = document.createElement("span");
        sb.className = "npt-sale " + hit.s + (c.quest ? " quest" : "");
        sb.textContent = SALE[hit.s][0];
        sb.title = SALE[hit.s][1] + (hit.sp != null ? " (" + hit.sp + "% sold)" : "") + "\nitemdb.com.br";
        c.el.appendChild(sb);
      }
      // NPC 商店：在商品名稱下面再標一次「好賣／普通／難賣」，字比較大、一眼看得到
      const nameEl = c.el.closest(".shop-item")?.querySelector(".item-name");
      if (nameEl) {
        nameEl.parentElement.querySelector(".npt-sale-txt")?.remove();
        if (hit.s && SALE[hit.s]) {
          const st = document.createElement("div");
          st.className = "npt-sale-txt " + hit.s;
          st.textContent = SALE[hit.s][0];
          st.title = SALE[hit.s][1] + (hit.sp != null ? " (" + hit.sp + "% sold)" : "");
          nameEl.insertAdjacentElement("afterend", st);
        }
      }
    }
  }

  // ---------- NPC 商店：利潤 ≥ 1 萬的商品清單 ----------
  // 左下角列出值得買的商品（利潤由高到低）。按「去買」= 捲到那件商品並幫你點它一下，
  // 之後的確認、人機驗證、出價都由你自己做；腳本不會自動送出。
  function dealsPanel(cells, cache) {
    if (!/\/objects\.phtml/.test(location.pathname)) return;
    const deals = [];
    const seen = new Set();
    for (const c of cells) {
      c.el.classList.remove("npt-deal-hl", "npt-deal-hot");
      const hit = cache[c.key];
      if (!hit || hit.v == null || !c.shopPrice || c.quest) continue;
      const gain = hit.v - c.shopPrice;
      if (gain < PROFIT_GOOD) continue;
      c.el.classList.add("npt-deal-hl");
      if (gain >= PROFIT_HOT) c.el.classList.add("npt-deal-hot");
      if (seen.has(c.el)) continue;
      seen.add(c.el);
      deals.push({ c, hit, gain });
    }
    document.querySelector(".npt-deals")?.remove();
    if (!deals.length) return;
    deals.sort((a, b) => b.gain - a.gain);
    const box = document.createElement("div");
    box.className = "npt-deals";
    box.innerHTML = `<h4><span>利潤 ≥ ${zh(PROFIT_GOOD)}：${deals.length} 件</span><button type="button" aria-label="關閉">✕</button></h4>`;
    box.querySelector("h4 button").onclick = () => box.remove();
    for (const d of deals) {
      const row = document.createElement("div");
      const hot = d.gain >= PROFIT_HOT;
      row.className = "row" + (hot ? " hot" : "");
      const sale = { ets: "好賣", regular: "普通", hts: "難賣" }[d.hit.s] || "";
      const q = encodeURIComponent(d.c.name);
      row.innerHTML =
        `<div class="info"><div class="nmrow"><span class="nm"></span>${hot ? '<span class="hot-badge">很可以買</span>' : ""}</div>` +
        `<div class="sub">店 ${d.c.shopPrice.toLocaleString("en-US")} → 市 ${d.hit.v.toLocaleString("en-US")}　<span class="gain">+${d.gain.toLocaleString("en-US")}</span></div>` +
        `<div class="meta">${sale ? `<span class="npt-sale-txt ${d.hit.s}">${sale}</span>` : ""}` +
        `<a href="https://itemdb.com.br/search?s=${q}" target="_blank" rel="noopener" title="在 itemdb 看行情和成交紀錄">🔗 查價</a>` +
        `<a href="/shops/wizard.phtml?string=${q}" target="_blank" rel="noopener" title="用商店精靈看玩家商店賣多少">🔗 商店精靈</a></div></div>` +
        `<button type="button" class="go">去買</button>`;
      row.querySelector(".nm").textContent = d.c.name;
      row.querySelector(".nm").title = d.c.name;
      row.querySelector(".go").onclick = () => {
        const el = d.c.el;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("npt-deal-flash"); void el.offsetWidth; el.classList.add("npt-deal-flash");
        // 跟你自己點商品圖一樣：打開這件商品的購買流程（有確認視窗就由你按）
        setTimeout(() => (el.closest("a") || el).click(), 350);
      };
      box.appendChild(row);
    }
    document.body.appendChild(box);
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
    questSummary(cells, cache);
    dealsPanel(cells, cache);

    const need = [];
    const seen = new Set();
    for (const c of cells) if ((!cache[c.key] || cache[c.key].s === undefined) && !seen.has(c.key)) { seen.add(c.key); need.push(c); }

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
          const val = { v: priceOf(it), r: it.rarity ?? null, s: it.saleStatus?.status ?? null, sp: it.saleStatus?.percent ?? null, t: now };
          byKey.set(it.name + "|" + img, val);
          if (!byKey.has(it.name + "|")) byKey.set(it.name + "|", val);
        }
        for (const c of need) {
          cache[c.key] = byKey.get(c.key) || byKey.get(c.name + "|") || { v: null, r: null, s: null, sp: null, t: now };
        }
        saveCache(cache);
        paint(cells, cache);
        questSummary(cells, cache);
        dealsPanel(cells, cache);
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
    const ours = (n) => n.nodeType !== 1 || n.matches(".npt-tag, .npt-sale, .npt-sale-txt, .npt-wrap, .npt-note, .npt-deals") || n.closest(".npt-note, .npt-deals");
    let timer = null;
    new MutationObserver((muts) => {
      if (!muts.some((m) => [...m.addedNodes].some((n) => !ours(n)))) return;
      clearTimeout(timer); timer = setTimeout(run, 600);
    }).observe(document.body, { childList: true, subtree: true });
    // 切換分頁時物品可能只是從隱藏變成顯示（沒有新增東西），所以點擊後也再檢查一次
    document.addEventListener("click", (e) => {
      if (e.target.closest?.(".npt-tag, .npt-note, .npt-deals")) return;
      clearTimeout(timer); timer = setTimeout(run, 800);
    }, true);
  })();
})();
