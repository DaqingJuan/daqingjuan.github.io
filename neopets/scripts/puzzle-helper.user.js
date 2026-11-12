// ==UserScript==
// @name         A Piece of Neopia 拼圖小幫手
// @namespace    neopets-sliding-helper
// @version      2.2
// @description  尼奧 27 週年拼圖（A Piece of Neopia）自動解滑塊拼圖（3x3、4x4、5x5、6x6 自動判斷）
// @match        https://www.neopets.com/games/slidingpuzzle/*
// @grant        none
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/puzzle-helper.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/puzzle-helper.user.js
// ==/UserScript==
//
// 用法（兩種擇一）：
//  1. 裝 Tampermonkey 擴充功能 → 新增腳本 → 貼上這整個檔案 → 存檔，打開拼圖頁右下角會出現面板。
//  2. 不裝擴充：打開拼圖頁 → 按 F12（Mac：Cmd+Option+J）開「主控台 Console」→ 貼上整個檔案 → Enter。
//
// 面板按鈕：
//  【解這一張】拼圖打亂後按一下：自動判斷是幾乘幾、偷看完成圖、算出解法並幫你推好。
//               3x3 用最短步數；4x4 以上用「一排一排收」的解法（步數多一點，但一定解得出來）。
//  【連續破關】一局 2 分鐘內一直解下去（3x3 → 4x4 → …，每解一張會加時間），直到你按「停止」或時間到。
//               時間到後要自己按 Send Score 送分（每天只有前 3 次送分算慶典通行證點數）。
//  【自動 3 局】從遊戲標題畫面或送分後的畫面開始：每局拼完 1 張就結束並送分，重複 3 次。
//               （每天只有前 3 次送分算慶典通行證點數，每次 +20 點）
//
// 注意：瀏覽器分頁要保持在前景、別縮小遊戲畫面，執行時不要動滑鼠點遊戲。

(() => {
  if (window.__puzzleHelper) return;
  window.__puzzleHelper = true;

  // 位置都用「畫布寬高的比例」表示，換螢幕或縮放也能用
  const BOARD = { x0: 0.2808, y0: 0.2952, w: 0.4410, h: 0.3309 }; // 拼圖區（整塊；幾乎乘幾都一樣大）
  const BTN = {
    peek: [0.3748, 0.7316],      // 眼睛（偷看完成圖）
    exit: [0.6371, 0.7316],      // 結束這局
    send: [0.4940, 0.7565],      // Send Score
    newGame: [0.4954, 0.6083],   // 送分成功後「Start a New Game」
    newGame2: [0.4988, 0.5635],  // 送分失敗時「Start a New Game」位置比較高
    start: [0.5400, 0.8530],     // 標題畫面 Start Game
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const canvas = () => document.getElementById("unity-canvas");

  function grab() {
    return new Promise((res) => {
      const c = canvas();
      requestAnimationFrame(() => {
        const t = document.createElement("canvas");
        t.width = c.width; t.height = c.height;
        const x = t.getContext("2d");
        x.drawImage(c, 0, 0);
        res(x.getImageData(0, 0, t.width, t.height));
      });
    });
  }

  async function click(fx, fy) {
    const c = canvas();
    const r = c.getBoundingClientRect();
    const X = r.left + fx * r.width, Y = r.top + fy * r.height;
    const ev = (type, buttons, Cls) => new Cls(type, {
      bubbles: true, cancelable: true, composed: true, clientX: X, clientY: Y,
      screenX: X, screenY: Y, button: 0, buttons, pointerId: 1, pointerType: "mouse", isPrimary: true, view: window,
    });
    // 先讓遊戲「看到」滑鼠停在按鈕上，按鈕類（偷看、送分）才會反應
    for (let k = 0; k < 4; k++) {
      c.dispatchEvent(ev("pointermove", 0, PointerEvent));
      c.dispatchEvent(ev("mousemove", 0, MouseEvent));
      document.dispatchEvent(ev("mousemove", 0, MouseEvent));
      await sleep(60);
    }
    c.dispatchEvent(ev("pointerdown", 1, PointerEvent));
    c.dispatchEvent(ev("mousedown", 1, MouseEvent));
    await sleep(200);
    c.dispatchEvent(ev("pointerup", 0, PointerEvent));
    c.dispatchEvent(ev("mouseup", 0, MouseEvent));
    document.dispatchEvent(ev("mouseup", 0, MouseEvent));
    window.dispatchEvent(ev("mouseup", 0, MouseEvent));
    c.dispatchEvent(ev("click", 0, MouseEvent));
  }
  const clickBtn = (k) => click(BTN[k][0], BTN[k][1]);
  const cellCenter = (p, N) => [BOARD.x0 + ((p % N) + 0.5) * BOARD.w / N, BOARD.y0 + (((p / N) | 0) + 0.5) * BOARD.h / N];

  // 每格取中間 80%（避開拼塊邊框），切成 6x6 小塊取平均色當特徵
  function feat(im, r, c, N) {
    const W = im.width, H = im.height;
    const x0 = BOARD.x0 * W, y0 = BOARD.y0 * H, cw = BOARD.w * W / N, ch = BOARD.h * H / N;
    const pw = cw * 0.8 / 6, ph = ch * 0.8 / 6, sx = Math.max(1, (pw / 6) | 0);
    const f = [];
    for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 6; gx++) {
      let s0 = 0, s1 = 0, s2 = 0, n = 0;
      for (let y = 0; y < ph; y += sx) for (let x = 0; x < pw; x += sx) {
        const px = (x0 + c * cw + cw * 0.1 + gx * pw + x) | 0, py = (y0 + r * ch + ch * 0.1 + gy * ph + y) | 0;
        const i = (py * W + px) * 4;
        s0 += im.data[i]; s1 += im.data[i + 1]; s2 += im.data[i + 2]; n++;
      }
      f.push(s0 / n, s1 / n, s2 / n);
    }
    return f;
  }
  const cells = (im, N) => { const a = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) a.push(feat(im, r, c, N)); return a; };
  // 空格是一整塊「完全一樣」的淺藍色 (202,240,255)：在拼圖區找最大的一塊淺藍色，
  // 用它的寬度推算是幾乘幾（佔整塊的 1/3 就是 3x3、1/4 就是 4x4…），再算出空格在第幾格
  function findBlank(im) {
    const W = im.width, H = im.height, s = 2;
    const X0 = Math.max(0, (BOARD.x0 - 0.02) * W | 0), Y0 = Math.max(0, (BOARD.y0 - 0.015) * H | 0);
    const X1 = Math.min(W - 1, (BOARD.x0 + BOARD.w + 0.02) * W | 0), Y1 = Math.min(H - 1, (BOARD.y0 + BOARD.h + 0.015) * H | 0);
    const gw = ((X1 - X0) / s | 0) + 1, gh = ((Y1 - Y0) / s | 0) + 1;
    const m = new Uint8Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const i = ((Y0 + gy * s) * W + (X0 + gx * s)) * 4;
      if (Math.abs(im.data[i] - 202) + Math.abs(im.data[i + 1] - 240) + Math.abs(im.data[i + 2] - 255) < 10) m[gy * gw + gx] = 1;
    }
    let best = null;
    const seen = new Uint8Array(gw * gh);
    for (let k = 0; k < m.length; k++) {
      if (!m[k] || seen[k]) continue;
      const q = [k]; seen[k] = 1;
      let n = 0, minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
      for (let h = 0; h < q.length; h++) {
        const p = q[h]; n++;
        const x = p % gw, y = (p / gw) | 0;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue;
          const pp = yy * gw + xx;
          if (m[pp] && !seen[pp]) { seen[pp] = 1; q.push(pp); }
        }
      }
      if (!best || n > best.n) best = { n, minx, maxx, miny, maxy };
    }
    if (!best) return null;
    const bw = (best.maxx - best.minx + 1) * s, bh = (best.maxy - best.miny + 1) * s;
    const fill = best.n * s * s / (bw * bh);
    const boardW = BOARD.w * W, boardH = BOARD.h * H;
    const N = Math.round(boardW / bw);
    if (!(fill > 0.85 && bw / bh > 0.8 && bw / bh < 1.25 && N >= 3 && N <= 8 && bw > boardW / 9)) return null;
    const cx = X0 + (best.minx + best.maxx) / 2 * s, cy = Y0 + (best.miny + best.maxy) / 2 * s;
    const col = Math.floor((cx - BOARD.x0 * W) / (boardW / N)), row = Math.floor((cy - BOARD.y0 * H) / (boardH / N));
    return { N, blank: row * N + col };
  }
  function detect(im) {
    const fb = findBlank(im);
    return fb ? { N: fb.N, now: cells(im, fb.N), blank: fb.blank } : null;
  }
  const dist = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

  // ===== 滑塊拼圖解法（任意 N×N）=====
  // st[pos] = 這格目前放的是「完成圖第幾格」；blank = 空格位置；空格自己的「完成位置」是 st[blank]。
  // 回傳：依序要點的格子位置（每次點空格旁邊那一格，讓它滑進空格）。

  // 3x3 以下（或最後剩的 3x3 區塊）：BFS 最短解。cells = 這個區域的格子位置清單
  function bfsRegion(st, blank, cells) {
    const idx = new Map(cells.map((p, i) => [p, i]));
    const N = Math.round(Math.sqrt(st.length));
    const start = cells.map((p) => String.fromCharCode(65 + st[p])).join("");
    const goal = cells.map((p) => String.fromCharCode(65 + p)).join("");
    const nb = cells.map((p) => {
      const r = (p / N) | 0, c = p % N, out = [];
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const q = (r + dr) * N + (c + dc);
        if (r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && idx.has(q)) out.push(idx.get(q));
      }
      return out;
    });
    const bi = idx.get(blank);
    const prev = new Map([[start, null]]);
    const q = [[start, bi]];
    for (let h = 0; h < q.length; h++) {
      const [s, b] = q[h];
      if (s === goal) break;
      for (const n of nb[b]) {
        const a = s.split("");
        [a[b], a[n]] = [a[n], a[b]];
        const t = a.join("");
        if (!prev.has(t)) { prev.set(t, [s, n]); q.push([t, n]); }
      }
    }
    if (!prev.has(goal)) return null;
    const path = [];
    for (let k = goal; prev.get(k); k = prev.get(k)[0]) path.unshift(cells[prev.get(k)[1]]);
    return path;
  }

  // 把幾個指定的拼塊移到正確位置（其他拼塊不管），frozen 的格子不能動。BFS 只記「空格＋這幾塊」的位置。
  function placeTiles(st, blank, targets, frozen, N) {
    const pos = targets.map((t) => st.indexOf(t));
    const key = (b, ps) => b + "," + ps.join(",");
    const start = key(blank, pos);
    const done = (ps) => ps.every((p, i) => p === targets[i]);
    if (done(pos)) return [];
    const prev = new Map([[start, null]]);
    const q = [[blank, pos]];
    for (let h = 0; h < q.length; h++) {
      const [b, ps] = q[h];
      const r = (b / N) | 0, c = b % N;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= N || cc < 0 || cc >= N) continue;
        const n = rr * N + cc;
        if (frozen.has(n)) continue;
        const nps = ps.map((p) => (p === n ? b : p));
        const k = key(n, nps);
        if (prev.has(k)) continue;
        prev.set(k, [key(b, ps), n]);
        if (done(nps)) {
          const path = [];
          for (let x = k; prev.get(x); x = prev.get(x)[0]) path.unshift(prev.get(x)[1]);
          return path;
        }
        q.push([n, nps]);
      }
    }
    return null;
  }

  function applyMoves(st, blank, path) {
    for (const n of path) { [st[blank], st[n]] = [st[n], st[blank]]; blank = n; }
    return blank;
  }

  // 主解法：N=3 直接 BFS；N≥4 一排一排、一列一列收掉，最後剩 3x3 再 BFS
  function solvePuzzle(state, blank) {
    const st = state.slice();
    const N = Math.round(Math.sqrt(st.length));
    const gb = st[blank]; // 空格的完成位置
    const gr = (gb / N) | 0, gc = gb % N;
    let r0 = 0, r1 = N - 1, c0 = 0, c1 = N - 1;
    const frozen = new Set();
    const all = [];
    const run = (targets) => {
      const p = placeTiles(st, blank, targets, frozen, N);
      if (!p) throw new Error("place fail");
      blank = applyMoves(st, blank, p);
      all.push(...p);
    };
    const line = (cells) => { // 一條線上的格子：前面一個一個放，最後兩個一起放
      for (let i = 0; i < cells.length - 2; i++) { run([cells[i]]); frozen.add(cells[i]); }
      run(cells.slice(-2)); cells.slice(-2).forEach((c) => frozen.add(c));
    };
    while (r1 - r0 + 1 > 3 || c1 - c0 + 1 > 3) {
      if (r1 - r0 + 1 > 3) {
        const r = gr === r0 ? r1 : r0; // 不收空格完成位置那一排
        const cells = []; for (let c = c0; c <= c1; c++) cells.push(r * N + c);
        line(cells);
        if (r === r0) r0++; else r1--;
      } else {
        const c = gc === c0 ? c1 : c0;
        const cells = []; for (let r = r0; r <= r1; r++) cells.push(r * N + c);
        line(cells);
        if (c === c0) c0++; else c1--;
      }
    }
    const region = []; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) region.push(r * N + c);
    const tail = bfsRegion(st, blank, region);
    if (!tail) return null;
    return all.concat(tail);
  }

  // 指派：n 塊拼塊 → m 個完成位置（n ≤ m），讓總差異最小（匈牙利演算法）
  function hungarian(cost) {
    const n = cost.length, m = cost[0].length, INF = 1e18;
    const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0;
      const minv = Array(m + 1).fill(INF), used = Array(m + 1).fill(false);
      do {
        used[j0] = true; const i0 = p[j0]; let delta = INF, j1 = 0;
        for (let j = 1; j <= m; j++) if (!used[j]) {
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= m; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const ans = Array(n).fill(-1);
    for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
    return ans;
  }


  // 等拼圖打亂完成：連續兩次看到「同樣大小、同一格」的空格才算（避免抓到打亂動畫的中間畫面）
  async function waitScrambled(maxMs = 20000) {
    let last = null;
    for (let t = 0; t < maxMs; t += 400) {
      const d = detect(await grab());
      if (d && last && d.N === last.N && d.blank === last.blank) return d;
      last = d;
      await sleep(400);
    }
    return null;
  }

  // 讀目前盤面：每塊拼塊對到完成圖的哪一格
  function readState(now, blank, ref) {
    const N = Math.round(Math.sqrt(now.length));
    const idx = [...Array(N * N).keys()].filter((i) => i !== blank);
    const cost = idx.map((i) => ref.map((g) => dist(now[i], g)));
    const asg = hungarian(cost);
    const st = Array(N * N).fill(-1);
    idx.forEach((i, k) => (st[i] = asg[k]));
    st[blank] = [...Array(N * N).keys()].find((j) => !asg.includes(j));
    return st;
  }

  async function solveOne(stopFlag) {
    const s = await waitScrambled();
    if (!s) throw new Error("找不到打亂後的拼圖（空格）");
    const N = s.N;
    // 偷看完成圖：按眼睛後要等到「空格消失」才算真的在看完成圖（按鈕偶爾沒反應就再按）
    let ref = null;
    for (let k = 0; k < 4 && !ref; k++) {
      await clickBtn("peek");
      for (let w = 0; w < 6; w++) {
        await sleep(250);
        const im = await grab();
        if (!findBlank(im)) { ref = cells(im, N); break; }
      }
    }
    if (!ref) throw new Error("偷看完成圖失敗");
    // 關掉偷看：要等到空格再出現
    await clickBtn("peek"); await sleep(900);
    for (let k = 0; k < 3; k++) {
      const dd = detect(await grab());
      if (dd && dd.N === N) break;
      await clickBtn("peek"); await sleep(1000);
    }
    const gap = N === 3 ? 400 : 300;
    let total = 0;
    for (let round = 0; round < 4; round++) {
      if (stopFlag && stopFlag()) throw new Error("已停止");
      const d = detect(await grab());
      if (!d || d.N !== N) break; // 空格不見了＝拼完了（完成圖會補上最後一塊）
      const st = readState(d.now, d.blank, ref);
      if (st.every((v, i) => v === i)) break;
      msg(`${N}x${N}：計算中…`);
      await sleep(30);
      const path = solvePuzzle(st, d.blank);
      if (!path) throw new Error("解不出來（可能比對錯了），請再按一次");
      msg(`${N}x${N}：推 ${path.length} 步`);
      for (const p of path) {
        if (stopFlag && stopFlag()) throw new Error("已停止");
        const [x, y] = cellCenter(p, N); await click(x, y); await sleep(gap);
      }
      total += path.length;
      await sleep(900);
    }
    return { N, moves: total };
  }

  // ---- 面板 ----
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;background:#fff8e6;border:2px solid #e8a31b;border-radius:12px;padding:10px 12px;font:14px/1.4 sans-serif;color:#222;box-shadow:0 4px 14px rgba(0,0,0,.2);display:grid;gap:6px;min-width:190px";
  box.innerHTML = '<b>拼圖小幫手 2.2</b><button id="ph-one">解這一張</button><button id="ph-run">連續破關（一直解）</button><button id="ph-auto">自動 3 局（拼 1 張就送分）</button><button id="ph-stop">停止</button><span id="ph-msg" style="font-size:12px;color:#555">準備好了</span>';
  document.body.appendChild(box);
  box.querySelectorAll("button").forEach((b) => (b.style.cssText = "font:inherit;padding:6px 10px;border-radius:8px;border:1px solid #c98a12;background:#ffd36b;cursor:pointer"));
  const msg = (t) => (box.querySelector("#ph-msg").textContent = t);
  let busy = false;

  box.querySelector("#ph-one").onclick = async () => {
    if (busy) return; busy = true;
    try { msg("解題中…"); const r = await solveOne(); msg(`完成 ${r.N}x${r.N}，推了 ${r.moves} 步`); }
    catch (e) { msg(e.message); }
    busy = false;
  };

  let stop = false;
  box.querySelector("#ph-stop").onclick = () => { stop = true; msg("停止中…"); };
  box.querySelector("#ph-run").onclick = async () => {
    if (busy) return; busy = true; stop = false;
    let k = 0;
    try {
      while (!stop) {
        k++;
        msg(`第 ${k} 張：等拼圖打亂`);
        const r = await solveOne(() => stop);
        msg(`第 ${k} 張完成：${r.N}x${r.N}，${r.moves} 步`);
        await sleep(1500);
      }
    } catch (e) { msg(`停在第 ${k} 張：` + e.message); }
    busy = false;
  };

  box.querySelector("#ph-auto").onclick = async () => {
    if (busy) return; busy = true;
    try {
      for (let k = 1; k <= 3; k++) {
        msg(`第 ${k} 局：開始遊戲`);
        if (k === 1) await clickBtn("start");
        else { await clickBtn("newGame"); await sleep(800); await clickBtn("newGame2"); }
        await sleep(1500);
        msg(`第 ${k} 局：等拼圖打亂`);
        const r = await solveOne();
        msg(`第 ${k} 局：拼完 ${r.N}x${r.N}（${r.moves} 步），結束並送分`);
        await sleep(3000);
        await clickBtn("exit"); await sleep(2500);
        await clickBtn("send"); await sleep(4000);
      }
      msg("3 局都送分了（每天只有前 3 次算點數）");
    } catch (e) { msg("中斷：" + e.message); }
    busy = false;
  };
})();
