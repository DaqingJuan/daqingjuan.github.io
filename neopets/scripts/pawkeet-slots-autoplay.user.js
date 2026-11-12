// ==UserScript==
// @name         Neopets - Black Pawkeet Slots Auto Play
// @namespace    neopets-pawkeet-slots
// @version      0.1.0
// @description  Black Pawkeet Slots (game_id=1099): auto click PLAY GAME, MAX BET, then PLAY in a loop. Start/Stop button at the top right.
// @match        https://www.neopets.com/games/game.phtml*game_id=1099*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://daqingjuan.github.io/neopets/scripts/pawkeet-slots-autoplay.user.js
// @updateURL    https://daqingjuan.github.io/neopets/scripts/pawkeet-slots-autoplay.user.js
// ==/UserScript==

(function () {
  'use strict';

  // ---- 設定 -------------------------------------------------------------
  const SPIN_WAIT_MS = 5000;   // 每次按 PLAY 後等待轉輪結束的時間（不夠的話調大）
  const JITTER_MS = 800;       // 隨機增加 0~800ms，避免每次間隔完全一樣
  const START_ON_LOAD = true;  // 進頁面後是否自動開始（false = 要自己按 Start）

  // 遊戲畫面（650x600）上各按鈕的相對位置 (x, y)，0~1
  const BTN = {
    playGame: [0.21, 0.63],    // 標題畫面的 PLAY GAME
    maxBet:   [0.844, 0.794],  // MAX BET
    play:     [0.503, 0.942],  // PLAY（轉一次）
  };
  // -----------------------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let running = false;
  let spins = 0;

  function getCanvas() {
    const frame = document.getElementById('game_frame');
    const doc = frame && frame.contentDocument;
    const embed = doc && doc.querySelector('ruffle-embed, ruffle-player, ruffle-object');
    const canvas = embed && embed.shadowRoot && embed.shadowRoot.querySelector('canvas');
    return canvas ? { canvas, win: doc.defaultView } : null;
  }

  async function click(name) {
    const g = getCanvas();
    if (!g) return false;
    const { canvas, win } = g;
    const b = canvas.getBoundingClientRect();
    const x = b.left + b.width * BTN[name][0];
    const y = b.top + b.height * BTN[name][1];
    const fire = (type, buttons) => {
      const isPointer = type.startsWith('pointer');
      const Ctor = isPointer ? win.PointerEvent : win.MouseEvent;
      canvas.dispatchEvent(new Ctor(type, {
        bubbles: true, cancelable: true, composed: true,
        clientX: x, clientY: y, screenX: x, screenY: y,
        pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons, view: win,
      }));
    };
    fire('pointerover', 0);
    fire('pointermove', 0);
    fire('mousemove', 0);
    await sleep(120);
    fire('pointerdown', 1);
    fire('mousedown', 1);
    await sleep(100);
    fire('pointerup', 0);
    fire('mouseup', 0);
    fire('click', 0);
    return true;
  }

  // ---- JACKPOT 偵測 ------------------------------------------------------
  // 每次轉動，遊戲都會向 pirate_slots.php 請求結果（XML）。
  // 其中 <jackpot_won></jackpot_won> 沒中時是空的，中了就會有內容。
  let hookedWin = null;
  function installHook() {
    const frame = document.getElementById('game_frame');
    const win = frame && frame.contentWindow;
    if (!win || hookedWin === win || !win.fetch) return;
    hookedWin = win;
    const origFetch = win.fetch;
    win.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);
      try {
        const url = String((args[0] && args[0].url) || args[0] || '');
        if (url.indexOf('pirate_slots.php') !== -1) {
          res.clone().text().then(checkSpinResult).catch(() => {});
        }
      } catch (e) { /* ignore */ }
      return res;
    };
  }

  function checkSpinResult(xml) {
    const m = xml.match(/<jackpot_won>([\s\S]*?)<\/jackpot_won>/i);
    const v = m ? m[1].trim() : '';
    if (v && !/^(0|false|no|none)$/i.test(v)) {
      running = false;
      jackpotHit = true;
      document.title = '🎰 JACKPOT! ' + document.title;
      render();
    }
  }
  let jackpotHit = false;

  async function loop() {
    installHook();
    // 先過標題畫面（在老虎機畫面上這個位置只是轉輪區，點了沒影響）
    await click('playGame');
    await sleep(1500);
    while (running) {
      installHook(); // iframe 重新載入時重新掛上
      if (!(await click('maxBet'))) { await sleep(1000); continue; }
      await sleep(700);
      if (!running) break;
      await click('play');
      spins++;
      render();
      await sleep(SPIN_WAIT_MS + Math.random() * JITTER_MS);
    }
  }

  // ---- 控制面板 ----------------------------------------------------------
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:99999;background:#222;color:#fff;' +
    'font:13px sans-serif;padding:8px 10px;border-radius:8px;box-shadow:0 2px 8px #0006;' +
    'display:flex;gap:8px;align-items:center';
  const btn = document.createElement('button');
  btn.style.cssText = 'cursor:pointer;padding:3px 10px;border-radius:5px;border:0;font-weight:bold';
  const info = document.createElement('span');
  panel.append(btn, info);
  document.body.appendChild(panel);

  function render() {
    btn.textContent = running ? '■ Stop' : '▶ Start';
    btn.style.background = running ? '#e55' : '#5c5';
    info.textContent = jackpotHit
      ? '🎰 JACKPOT! 已停止 | spins ' + spins
      : 'Slots auto: ' + (running ? 'ON' : 'OFF') + ' | spins ' + spins;
  }

  function setRunning(v) {
    if (v === running) return;
    running = v;
    if (v) jackpotHit = false;
    render();
    if (running) loop();
  }

  btn.addEventListener('click', () => setRunning(!running));
  render();

  if (START_ON_LOAD) {
    // 等遊戲載入完成
    const t = setInterval(() => {
      if (getCanvas()) {
        clearInterval(t);
        setTimeout(() => setRunning(true), 2500);
      }
    }, 500);
  }
})();
