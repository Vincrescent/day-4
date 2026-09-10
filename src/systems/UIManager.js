/**
 * UIManager — HUD overlay management.
 * Handles: turn indicator, captured pieces, move history (scrollable+clickable),
 * chess clock, FPS counter, start menu, confirm dialogs, toasts, thinking indicator,
 * board flip indicator, keyboard shortcut hints.
 */
const PIECE_SYM = {
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
};
const PIECE_ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 }; // sort captured: high value first

export class UIManager {
  constructor() {
    this.el = {
      loader: document.getElementById('loader'),
      loaderFill: document.getElementById('loaderFill'),
      loaderStatus: document.getElementById('loaderStatus'),
      ui: document.getElementById('ui'),
      turn: document.getElementById('turnIndicator'),
      check: document.getElementById('checkBadge'),
      checkmate: document.getElementById('checkmateBadge'),
      capWhite: document.getElementById('capturedWhitePieces'),
      capBlack: document.getElementById('capturedBlackPieces'),
      history: document.getElementById('moveHistory'),
      gameOver: document.getElementById('gameOverOverlay'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverSub: document.getElementById('gameOverSub'),
      clockWhite: document.getElementById('clockWhite'),
      clockBlack: document.getElementById('clockBlack'),
      fps: document.getElementById('fpsCounter'),
      thinking: document.getElementById('thinkingBadge'),
      startMenu: document.getElementById('startMenuOverlay'),
      confirmOverlay: document.getElementById('confirmOverlay'),
      toast: document.getElementById('toastContainer'),
    };
  }

  showLoader() {
    this.el.loader.style.display = 'flex';
    this.el.ui.classList.add('hidden');
  }
  hideLoader() {
    this.el.loader.style.display = 'none';
    this.el.ui.classList.remove('hidden');
  }
  setProgress(pct) {
    if (this.el.loaderFill) this.el.loaderFill.style.width = pct + '%';
  }
  setStatus(txt) {
    if (this.el.loaderStatus) this.el.loaderStatus.textContent = txt;
  }

  setTurn(white) {
    if (this.el.turn) {
      this.el.turn.textContent = white ? "White to move" : "Black to move";
      this.el.turn.style.color = white ? '#f0e0c0' : '#8a7a6a';
    }
  }

  showCheck(on) {
    if (this.el.check) this.el.check.style.display = on ? 'inline-block' : 'none';
  }

  showCheckmate(on, winner) {
    if (!this.el.checkmate) return;
    this.el.checkmate.style.display = on ? 'inline-block' : 'none';
    if (on && winner) this.el.checkmate.textContent = 'Checkmate \u2014 ' + winner + ' wins';
  }

  setCaptured(captured) {
    if (!this.el.capWhite) return;
    const sort = arr => [...arr].sort((a, b) => (PIECE_ORDER[a] ?? 5) - (PIECE_ORDER[b] ?? 5));
    this.el.capWhite.innerHTML = sort(captured.w || [])
      .map(p => `<span title="${p}">${PIECE_SYM[p.toUpperCase()] || ''}</span>`).join('');
    this.el.capBlack.innerHTML = sort(captured.b || [])
      .map(p => `<span title="${p}">${PIECE_SYM[p.toUpperCase()] || ''}</span>`).join('');
  }

  setHistory(history) {
    if (!this.el.history) return;
    let out = '';
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const wMove = history[i];
      const bMove = history[i + 1] || '';
      out += `<span class="move-pair" data-move-idx="${i}">`;
      out += `<span class="move-num">${moveNum}.</span>`;
      out += `<span class="move-san" data-idx="${i}">${wMove}</span>`;
      if (bMove) out += `<span class="move-san" data-idx="${i+1}">${bMove}</span>`;
      out += `</span>`;
    }
    this.el.history.innerHTML = out;
    // Auto-scroll to bottom
    this.el.history.scrollTop = this.el.history.scrollHeight;
  }

  // ─── CHESS CLOCK ──────────────────────────────────────────────
  updateClock(wMs, bMs, clock) {
    if (!this.el.clockWhite || !this.el.clockBlack) return;
    if (clock.isUnlimited()) {
      this.el.clockWhite.textContent = '\u221E';
      this.el.clockBlack.textContent = '\u221E';
      this.el.clockWhite.classList.remove('clock-danger');
      this.el.clockBlack.classList.remove('clock-danger');
    } else {
      this.el.clockWhite.textContent = clock.getDisplay(wMs);
      this.el.clockBlack.textContent = clock.getDisplay(bMs);
      // Flash red when < 30s
      this.el.clockWhite.classList.toggle('clock-danger', wMs < 30000);
      this.el.clockBlack.classList.toggle('clock-danger', bMs < 30000);
    }
  }

  // ─── FPS ──────────────────────────────────────────────────────
  setFPS(fps) {
    if (this.el.fps) this.el.fps.textContent = `${fps} FPS`;
  }

  // ─── THINKING BADGE ───────────────────────────────────────────
  showThinking(on) {
    if (this.el.thinking) this.el.thinking.style.display = on ? 'inline-block' : 'none';
  }

  // ─── BOARD FLIP INDICATOR ─────────────────────────────────────
  setFlipped(flipped) {
    const btn = document.getElementById('btnFlip');
    if (btn) btn.textContent = flipped ? 'Flip \u21BB' : 'Flip \u21BA';
  }

  // ─── TOAST ────────────────────────────────────────────────────
  showToast(msg, duration = 2500) {
    if (!this.el.toast) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    this.el.toast.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => {
      t.classList.remove('visible');
      setTimeout(() => t.remove(), 400);
    }, duration);
  }

  // ─── CONFIRM DIALOG ──────────────────────────────────────────
  showConfirm(title, message, onResult) {
    if (!this.el.confirmOverlay) return;
    const overlay = this.el.confirmOverlay;
    overlay.querySelector('.confirm-title').textContent = title;
    overlay.querySelector('.confirm-msg').textContent = message;
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');

    const yesBtn = overlay.querySelector('.confirm-yes');
    const noBtn = overlay.querySelector('.confirm-no');

    const cleanup = () => {
      overlay.classList.remove('visible');
      overlay.classList.add('hidden');
      yesBtn.onclick = null;
      noBtn.onclick = null;
    };

    yesBtn.onclick = () => { cleanup(); onResult(true); };
    noBtn.onclick = () => { cleanup(); onResult(false); };
  }

  // ─── START MENU ───────────────────────────────────────────────
  showStartMenu(onStart) {
    const overlay = this.el.startMenu;
    if (!overlay) {
      // Fallback: immediately start with defaults
      onStart({ vsAI: false, timeMode: 'unlimited' });
      return;
    }
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');

    const form = overlay.querySelector('.start-form');
    if (!form) {
      onStart({ vsAI: false, timeMode: 'unlimited' });
      return;
    }

    // Reset form
    const modeSelect = form.querySelector('#gameMode');
    const diffSelect = form.querySelector('#difficulty');
    const diffRow = form.querySelector('.diff-row');
    const timeSelect = form.querySelector('#timeMode');

    if (modeSelect) {
      modeSelect.value = 'ai';
      if (diffRow) diffRow.style.display = '';
    }

    // Toggle difficulty visibility
    if (modeSelect && diffRow) {
      modeSelect.onchange = () => {
        diffRow.style.display = modeSelect.value === 'ai' ? '' : 'none';
      };
    }

    const startBtn = form.querySelector('.start-btn');
    startBtn.onclick = () => {
      const vsAI = modeSelect ? modeSelect.value === 'ai' : false;
      const difficulty = diffSelect ? diffSelect.value : 'medium';
      const timeMode = timeSelect ? timeSelect.value : 'unlimited';
      overlay.classList.remove('visible');
      overlay.classList.add('hidden');
      onStart({ vsAI, difficulty, timeMode, aiColor: 'b' });
    };
  }

  // ─── GAME OVER ────────────────────────────────────────────────
  showGameOver(title, sub, onBtn) {
    if (!this.el.gameOver) return;
    this.el.gameOver.classList.remove('hidden');
    this.el.gameOver.classList.add('visible');
    if (this.el.gameOverTitle) this.el.gameOverTitle.textContent = title;
    if (this.el.gameOverSub) this.el.gameOverSub.textContent = sub;
    const btn = document.getElementById('btnGameOverNew');
    if (btn) {
      btn.onclick = () => {
        this.hideGameOver();
        onBtn && onBtn();
      };
    }
  }
  hideGameOver() {
    if (this.el.gameOver) {
      this.el.gameOver.classList.remove('visible');
      this.el.gameOver.classList.add('hidden');
    }
  }
}
