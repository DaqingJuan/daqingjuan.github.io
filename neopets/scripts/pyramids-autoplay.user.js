// ==UserScript==
// @name         Neopets 金字塔自動玩（Pyramids Auto Play）
// @namespace    neopets-pyramids-autoplay
// @version      1.1
// @description  Pyramids 紙牌遊戲自動玩：自動挑最長連鎖的牌、翻開最多蓋牌，直到清空金字塔次數達標（拿 Pyramid Bonus 獎盃）
// @match        https://www.neopets.com/games/pyramids/*
// @grant        none
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/pyramids-autoplay.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/pyramids-autoplay.user.js
// ==/UserScript==
//
// 用法：打開 https://www.neopets.com/games/pyramids/index.phtml ，右下角面板設定
//   「目標清空次數」（銅牌 2 次、銀牌 5 次）和「最多玩幾局」，按「開始」。
//   要拿金牌（連續 2 局都清空）就勾「拚金牌」：會一直玩到連續清空 2 局才停。
//   「最多跑幾分鐘」可以把長時間的拚金牌分成好幾次跑（預設一次跑 60 分鐘）。
//   累計戰績（總局數、清空次數）會記在這台電腦的瀏覽器裡，重開頁面也看得到。
// 每局 50 NP，通常會贏回更多；每天贏到 5,000 NP 上限後，之後的局都免費。
// 清空金字塔靠運氣（大約每 30 局 1 次），拿銅牌大約要 1 小時左右。
// 注意：這是自動操作，Neopets 規定不能用機器人，有被凍結帳號的風險，自己評估。
// 執行中不要重新整理或關掉這個分頁；切到其他分頁沒關係。

(() => {
  "use strict";
  if (window.__pyrAuto) return;
  window.__pyrAuto = true;

  // ---------- 金字塔座標（28 張，第 r 排有 r 張；位置 1~28）----------
  const rowOf = (p) => { let r = 1; while ((r * (r + 1)) / 2 < p) r++; return r; };
  const posOf = (r, k) => (r * (r - 1)) / 2 + 1 + k;
  const kids = (p) => { const r = rowOf(p), k = p - ((r * (r - 1)) / 2 + 1); return r === 7 ? [] : [posOf(r + 1, k), posOf(r + 1, k + 1)]; };
  const parents = (p) => {
    const r = rowOf(p), k = p - ((r * (r - 1)) / 2 + 1), out = [];
    if (r === 1) return out;
    if (k - 1 >= 0) out.push(posOf(r - 1, k - 1));
    if (k <= r - 2) out.push(posOf(r - 1, k));
    return out;
  };
  // 相鄰點數才能接（A 可以接 2 和 K）
  const adj = (a, b) => Math.abs(a - b) === 1 || (a === 14 && b === 2) || (a === 2 && b === 14);

  // 解析遊戲頁：目前的牌、可點的牌、抽牌、收錢連結
  function parse(html) {
    const d = new DOMParser().parseFromString(html, "text/html");
    const imgs = [...d.querySelectorAll("img")].filter((i) => /\/(\d+_\w+|pyramid)\.gif/.test(i.src));
    let target = null, draw = null;
    const face = [];
    for (const i of imgs) {
      const a = i.closest("a");
      const h = a ? a.getAttribute("href") : "";
      const m = i.src.match(/\/(\d+)_(\w+)\.gif/);
      if (/action=draw/.test(h)) draw = h;
      else if (m && !a && target === null) target = +m[1];
      else if (m && /action=play/.test(h)) face.push({ pos: +h.match(/position=(\d+)/)[1], rank: +m[1], href: h });
    }
    const collect = [...d.querySelectorAll("a")].find((a) => /action=collect/.test(a.getAttribute("href") || ""))?.getAttribute("href");
    const text = (d.body?.textContent || "").replace(/\s+/g, " ");
    return { target, draw, face, text, collect };
  }

  // 用 fetch 操作（不用計時器，切到背景分頁也不會被 Chrome 放慢）
  const get = async (href) => (await fetch(new URL(href, location.href).href, { credentials: "include" })).text();

  async function playOne(stopFlag) {
    let html = await get("/games/pyramids/pyramids.phtml");
    if (parse(html).target === null) {
      html = await (await fetch("/games/pyramids/pyramids.phtml", { method: "POST", credentials: "include" })).text();
    }
    const removed = new Set();
    for (let steps = 0; steps < 240; steps++) {
      if (stopFlag()) return { status: "stopped" };
      const st = parse(html);
      if (st.face.length === 0 && st.target !== null) {
        if (st.collect) await get(st.collect);
        return { status: "cleared", steps };
      }
      if (st.collect) {
        html = await get(st.collect);
        const won = +((parse(html).text.match(/([\d,]+) Neopoints/) || [])[1] || "0").replace(/,/g, "");
        return { status: "nomoves", steps, left: st.face.length, won };
      }
      if (st.target === null) return { status: "unknown", snip: st.text.slice(0, 160) };

      // 找能接最長的一串；一樣長的話，挑能翻開最多蓋牌的
      let best = { len: 0, rev: -1, first: null };
      const rec = (t, used, len, rev, first) => {
        let any = false;
        for (const f of st.face) {
          if (used.has(f.pos) || !adj(t, f.rank)) continue;
          any = true;
          used.add(f.pos);
          const rm = new Set([...removed, ...used]);
          let nr = 0;
          for (const par of parents(f.pos)) if (!rm.has(par) && kids(par).every((c) => rm.has(c))) nr++;
          rec(f.rank, used, len + 1, rev + nr, first || f);
          used.delete(f.pos);
        }
        if (!any && (len > best.len || (len === best.len && rev > best.rev))) best = { len, rev, first };
      };
      rec(st.target, new Set(), 0, 0, null);

      let href;
      if (best.first) { href = best.first.href; removed.add(best.first.pos); }
      else if (st.draw) href = st.draw;
      else href = st.face[0].href; // 沒得接也沒牌可抽：點一張讓遊戲結算
      html = await get(href);
    }
    return { status: "maxsteps" };
  }

  // ---------- 面板 ----------
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;background:#fff8e6;border:2px solid #e8a31b;border-radius:12px;padding:10px 12px;font:13px/1.5 sans-serif;color:#222;box-shadow:0 4px 14px rgba(0,0,0,.2);display:grid;gap:6px;width:220px";
  box.innerHTML =
    '<b style="font-size:14px">金字塔自動玩</b>' +
    '<label>目標清空次數 <input id="pa-goal" type="number" min="1" value="2" style="width:56px"></label>' +
    '<label>最多玩幾局 <input id="pa-max" type="number" min="1" value="100" style="width:56px"></label>' +
    '<label>最多跑幾分鐘 <input id="pa-min" type="number" min="1" value="60" style="width:56px"></label>' +
    '<label><input id="pa-gold" type="checkbox"> 拚金牌（連續 2 局清空才停）</label>' +
    '<div style="display:flex;gap:6px"><button id="pa-start">開始</button><button id="pa-stop">停止</button></div>' +
    '<div id="pa-stat">還沒開始</div><div id="pa-last" style="font-size:12px;color:#666"></div>' +
    '<div id="pa-total" style="font-size:12px;color:#666"></div>';
  document.body.appendChild(box);
  box.querySelectorAll("button").forEach((b) => (b.style.cssText = "flex:1;font:inherit;padding:5px 8px;border-radius:8px;border:1px solid #c98a12;background:#ffd36b;cursor:pointer"));
  const $ = (id) => box.querySelector("#" + id);

  let running = false, stop = false;
  const s = { games: 0, clears: 0, won: 0, streak: 0 };
  // 累計戰績存在瀏覽器（localStorage），讀寫失敗也不影響玩
  const TKEY = "pyrAutoTotals";
  const loadT = () => { try { return JSON.parse(localStorage.getItem(TKEY)) || { games: 0, clears: 0, bestStreak: 0 }; } catch { return { games: 0, clears: 0, bestStreak: 0 }; } };
  const saveT = (t) => { try { localStorage.setItem(TKEY, JSON.stringify(t)); } catch {} };
  const total = loadT();
  const show = () => {
    $("pa-stat").textContent = `這次：${s.games} 局｜清空 ${s.clears} 次｜連續 ${s.streak}｜贏 ${s.won.toLocaleString()} NP`;
    const rate = total.games ? ((total.clears / total.games) * 100).toFixed(1) : "0";
    $("pa-total").textContent = `累計：${total.games} 局｜清空 ${total.clears} 次（${rate}%）｜最長連續 ${total.bestStreak}`;
  };
  show();

  $("pa-stop").onclick = () => { stop = true; $("pa-last").textContent = "停止中（這一步做完就停）…"; };
  $("pa-start").onclick = async () => {
    if (running) return;
    running = true; stop = false;
    const goal = +$("pa-goal").value || 2, max = +$("pa-max").value || 100;
    const minutes = +$("pa-min").value || 180, gold = $("pa-gold").checked;
    const startClears = s.clears, startGames = s.games, t0 = Date.now();
    const reached = () => (gold ? s.streak >= 2 : s.clears - startClears >= goal);
    let why = "";
    show();
    try {
      while (!stop && !reached()) {
        if (s.games - startGames >= max) { why = "到局數上限，停止"; break; }
        if (Date.now() - t0 > minutes * 60000) { why = "到時間上限，停止"; break; }
        $("pa-last").textContent = "第 " + (s.games + 1) + " 局進行中…";
        const r = await playOne(() => stop);
        if (r.status === "stopped") break;
        if (r.status === "unknown") { $("pa-last").textContent = "讀不到牌局，請重新整理再試"; break; }
        s.games++; total.games++;
        if (r.status === "cleared") {
          s.clears++; s.streak++; total.clears++;
          total.bestStreak = Math.max(total.bestStreak, s.streak);
          $("pa-last").textContent = `第 ${s.games} 局：清空金字塔！（連續 ${s.streak} 局）`;
        } else {
          s.streak = 0; s.won += r.won || 0;
          $("pa-last").textContent = `第 ${s.games} 局：剩 ${r.left ?? "?"} 張可點，贏 ${r.won || 0} NP`;
        }
        saveT(total);
        show();
      }
      if (!stop) $("pa-last").textContent += "｜" + (reached() ? (gold ? "連續清空 2 局，金牌條件達成！" : "達標，停止") : why);
    } catch (e) {
      $("pa-last").textContent = "出錯：" + e.message;
    }
    running = false;
  };
})();
