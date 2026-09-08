/**
 * UIManager — HUD overlay management.
 */
const PIECE_SYM = {
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F', // white
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659', // black
};

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
    if (this.el.turn) this.el.turn.textContent = white ? "White to move" : "Black to move";
    if (this.el.turn) {
      this.el.turn.style.color = white ? '#f0e0c0' : '#8a7a6a';
    }
  }

  showCheck(on) {
    if (this.el.check) this.el.check.classList.toggle('hidden', !on);
  }

  showCheckmate(on, winner) {
    if (!this.el.checkmate) return;
    this.el.checkmate.classList.toggle('hidden', !on);
    if (on && winner) this.el.checkmate.textContent = 'Checkmate \u2014 ' + winner + ' wins';
  }

  setCaptured(captured) {
    if (!this.el.capWhite) return;
    this.el.capWhite.innerHTML = (captured.w || [])
      .map(p => `<span title="${p}">${PIECE_SYM[p.toUpperCase()] || ''}</span>`).join('');
    this.el.capBlack.innerHTML = (captured.b || [])
      .map(p => `<span title="${p}">${PIECE_SYM[p.toUpperCase()] || ''}</span>`).join('');
  }

  setHistory(history) {
    if (!this.el.history) return;
    let out = '';
    for (let i = 0; i < history.length; i += 2) {
      out += `${Math.floor(i / 2) + 1}. ${history[i]}`;
      if (history[i + 1]) out += ` ${history[i + 1]}`;
      out += '&nbsp;&nbsp;';
    }
    this.el.history.innerHTML = out;
  }

  showGameOver(title, sub, onBtn) {
    if (!this.el.gameOver) return;
    this.el.gameOver.classList.toggle('visible', true);
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
    if (this.el.gameOver) this.el.gameOver.classList.remove('visible');
  }
}
