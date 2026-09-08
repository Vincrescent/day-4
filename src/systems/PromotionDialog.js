/**
 * PromotionDialog — minimal overlay to let the player pick the promoted piece.
 */
export class PromotionDialog {
  constructor() {
    this.el = document.getElementById('promoOverlay');
    this.choices = document.getElementById('promoChoices');
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
  }

  show(options, color, onPick) {
    this.choices.innerHTML = '';
    const symbols = { q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E' };
    const labels = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'promo-btn ' + (color === 'w' ? 'white' : 'black');
      btn.innerHTML = `<span class="sym">${symbols[opt]}</span><span class="lbl">${labels[opt]}</span>`;
      btn.onclick = () => { this.hide(); onPick(opt); };
      this.choices.appendChild(btn);
    }
    this.el.classList.add('visible');
  }

  hide() {
    this.el.classList.remove('visible');
  }
}
