/**
 * Medieval 3D Chess — Application entry point
 * Bootstrap the Game engine when the DOM is ready.
 */
import { Game } from './systems/Game.js';

function boot() {
  window.game = new Game();
  window.game.init().catch(err => {
    console.error('[Bootstrap] Fatal init error:', err);
    const status = document.getElementById('loaderStatus');
    if (status) status.textContent = 'Something went wrong: ' + err.message;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
