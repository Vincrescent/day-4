#!/usr/bin/env node
/* Solar Watch e2e — jsdom harness */
const fs = require('fs');
const path = require('path');
const os = require('os');
const JSDOM_PATH = path.join(os.tmpdir(), 'node_modules', 'jsdom').split(path.sep).join('/');
let JSDOM;
try { JSDOM = require(JSDOM_PATH).JSDOM; }
catch (e) { JSDOM = require('jsdom').JSDOM; }

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`[PASS] ${name}`); }
  else { fail++; console.log(`[FAIL] ${name} ${detail}`); }
}

const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost:8321/index.html',
  beforeParse(window) {
    window.onerror = (m) => errors.push(String(m));
    // canvas stub — jsdom has no 2d context
    const ctxStub = new Proxy({}, {
      get: (t, p) => {
        if (p === 'canvas') return window.canvas;
        if (p === 'createRadialGradient' || p === 'createLinearGradient')
          return () => ({ addColorStop: () => {} });
        if (p === 'measureText') return () => ({ width: 0 });
        return typeof p === 'string' ? (() => {}) : undefined;
      },
      set: () => true,
    });
    window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
    window.devicePixelRatio = 1;
    // fetch stub (NeoWs)
    window.fetch = (url) => {
      const today = new Date().toISOString().slice(0, 10);
      if (url.includes('neo/rest/v1/feed')) {
        return Promise.resolve({ json: () => Promise.resolve({
          element_count: 2,
          near_earth_objects: { [today]: [
            { name: 'TEST-AST-1', is_hazardous: true,
              estimated_diameter: { kilometers: { estimated_diameter_min: 0.01, estimated_diameter_max: 0.1 } },
              close_approach_data: [{ miss_distance: { lunar: '12.3' } }] },
            { name: 'TEST-AST-2', is_hazardous: false,
              estimated_diameter: { kilometers: { estimated_diameter_min: 0.5, estimated_diameter_max: 1.2 } },
              close_approach_data: [{ miss_distance: { lunar: '45.0' } }] },
          ] },
        }) });
      }
      return Promise.reject(new Error('unexpected fetch: ' + url));
    };
  },
});

const { window } = dom;
const { document } = window;

setTimeout(async () => {
  try {
    check('no uncaught errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));

    // header
    check('title present', document.title.includes('Solar Watch'));
    check('live badge', !!document.querySelector('.live-badge'));

    // planets
    const rows = document.querySelectorAll('.planet-row');
    check('8 planet rows (no sun)', rows.length === 8, `got ${rows.length}`);
    const names = [...rows].map(r => r.querySelector('.pname').textContent);
    for (const n of ['Merkurius', 'Venus', 'Bumi', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptunus']) {
      check(`planet ${n} listed`, names.includes(n));
    }
    check('distance rendered', rows[0].querySelector('.pdist').textContent.includes('AU'));

    // asteroids (async)
    await new Promise(r => setTimeout(r, 300));
    const asts = document.querySelectorAll('.ast-item');
    check('asteroids loaded (2)', asts.length === 2, `got ${asts.length}`);
    check('hazard class applied', document.querySelector('.ast-item.hazard') !== null);
    check('hazard name shown', document.body.textContent.includes('TEST-AST-1'));

    // showers
    const showers = document.querySelectorAll('.shower-item');
    check('9 showers listed', showers.length === 9, `got ${showers.length}`);
    check('shower has ZHR', document.body.textContent.includes('ZHR 150'));

    // mode pills
    const pills = document.querySelectorAll('.mode-pill');
    check('4 mode pills', pills.length === 4);
    pills[1].click();
    check('earth mode activates', pills[1].classList.contains('active') && !pills[0].classList.contains('active'));
    pills[0].click();
    check('overview mode restores', pills[0].classList.contains('active'));

    // status card
    check('status mentions NeoWs', document.getElementById('status').textContent.includes('NeoWs'));

    // clock ticking
    check('clock has time', /\d{2}[.:]\d{2}/.test(document.getElementById('clock').textContent), JSON.stringify(document.getElementById('clock').textContent));
    check('refresh timer present', document.getElementById('rt').textContent.toLowerCase().includes('refresh'));

  } catch (e) {
    check('unexpected exception', false, e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
  }

  console.log(`\n==== e2e summary ====\n  ${pass}/${pass + fail} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 800);
