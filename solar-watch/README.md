# SOLAR WATCH

**Day 4 — 30 Days Make a Project** · Pemantau aktivitas tata surya real-time di browser.

Buka `index.html` langsung (double-click) atau via `python -m http.server`. Tanpa build step, tanpa dependency.

## Yang dipantau

| Layer | Sumber data | Cara kerja |
|---|---|---|
| **Posisi planet (realtime)** | Elemen Keplerian J2000 (NASA/JPL *Standard elements for the major planets*) | Disediakan offline di browser: mean anomaly → Newton-Raphson untuk eccentric anomaly → koordinat ekliptik. Validasi: semua 8 planet jatuh di rentang perihelion-aphelion, longitude Bumi selaras logika ekuinoks (error < 1°). |
| **Asteroid dekat Bumi (today)** | [NASA NeoWs API](https://api.nasa.gov) (`DEMO_KEY`) | CORS `*`, fetch langsung dari browser, refresh 60 detik. Menampilkan diameter, jarak (dalam satuan jarak Bumi-Bulan), flag hazardous. |
| **Meteor showers** | Kalender IAU (data fisika publik) | 9 shower utama dengan jendela aktif & ZHR; shower yang sedang peak di-highlight. |

## Kontrol

- **Scroll** = zoom · **Drag** = geser · **Klik planet** = fokus kamera
- Mode: `OVERVIEW` (seluruh sistem) · `EARTH VIEW` · `INNER PLANETS` · `OUTER PLANETS`
- Panel kanan: posisi AU + kecepatan km/s (vis-viva) per planet, live feed asteroid, kalender shower

## Struktur

```
solar-watch/
├── index.html      # single-file app (HTML+CSS+JS, 0 dependency)
└── test/
    └── e2e.cjs     # jsdom e2e — 24/24 checks
```

## Verifikasi

```
node test/e2e.cjs   # → 24/24 checks passed
```

Solver orbit tervalidasi independen: posisi Bumi 8 Sept (lon 345°) cocok dengan prediksi ekuinoks (ekuador musim gugur 22 Sept → ~346°).

## Data & lisensi

- Elemen planet: tabel publik NASA/JPL (public domain) — bukan scrape, dihitung sendiri
- NeoWs: API publik NASA, `DEMO_KEY`
- Kalender shower: data fisika IAU
- 0 aset pihak ketiga, 0 byte dari project lain
