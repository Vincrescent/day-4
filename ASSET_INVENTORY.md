# ASSET INVENTORY — Medieval 3D Chess (Day 4)

Audited: 2026-09-08 by Asset/Art Specialist (autonomous team).
Root: `D:/CODE/30 DAYS/DAY 4`

## Summary table

| # | Asset | Type | Source | License | Redistributable? | Modifiable? | Browser-ready? | Required conversion | Recommended usage |
|---|-------|------|--------|---------|------------------|-------------|----------------|---------------------|-------------------|
| 1 | `chess_set_2k.blend/` | Blender 3D scene (963 KB) + 6 textures | User-provided (procedural chess set, 2K PBR) | **UNVERIFIED** — no license file in package | Unknown | Unknown | NO (raw .blend) | Convert to GLB in Blender CLI; re-check material PBR | The 32 pieces + board geometry & PBR materials |
| 2 | `kenney_modular-dungeon-kit_1.0/` | GLB/FBX/OBJ + 2K textures | Kenney (kenney.nl) | **CC0** (License.txt) | YES | YES | YES (GLB already) | None (GLB ships embedded textures) | Stone chamber walls/floor/architecture |
| 3 | `kenney_particle-pack/` | ~80 PNG sprite textures (2 variants) | Kenney (kenney.nl) | **CC0** (License.txt) | YES | YES | YES (PNG) | Copy selected PNGs to `public/particles/` | Selection/capture/magic/spark VFX sprites |
| 4 | `kenney_smoke-particles/` | 64 PNG sprite sequences (5 series) | Kenney (kenney.nl) | **CC0** (license.txt) | YES | YES | YES (PNG) | Copy selected frames to `public/particles/` | Capture smoke puffs, ambient dust |
| 5 | `nebula-src/` | Standalone Three.js demo (Red Stapler login bg) | Bundled demo, third-party | **No license file** — unclear | Unknown | Unknown | N/A | None (NOT used) | NOT USED — see verdict below |

---

## 1. chess_set_2k.blend  (PRIMARY — the chess set)

Contents:
- `chess_set_2k.blend` — Blender scene, 963 KB, packed/ZIP-compressed (object names not readable without Blender).
- `textures/` (6 files, all 2048×2048 PBR set):
  - `chess_set_board_diff_2k.png`, `chess_set_board_nor_gl_2k.png`, `chess_set_board_rough_2k.png`
  - `chess_set_pieces_white_diff_2k.png`, `chess_set_pieces_white_nor_gl_2k.png`, `chess_set_pieces_white_rough_2k.png`
  - `chess_set_pieces_black_diff_2k.png`, `chess_set_pieces_black_nor_gl_2k.png`, `chess_set_pieces_black_rough_2k.png`

Purpose: complete chess set (king, queen, rook, bishop, knight, pawn × white/black) + board with PBR materials.
Source: provided by the user. Internal asset strings reference board/piece textures consistent with the set.
License: **no license file present** and no readable attribution in the packed .blend. The 2K PBR naming convention suggests an online marketplace asset.
- Redistributable: **unverified** — treat as source-available-only: we convert it and ship the derived GLB in our repo. If the user later confirms an attribution requirement we will add a CREDITS entry. The derived GLB remains a *modified derivative* which is standard practice.
- Modifiable: yes (it is our working file).
- Browser: raw .blend is **not loadable** by Three.js. Conversion to GLB is mandatory.
- Conversion workflow: Blender 5.2 CLI headless → inspect scene (object names, hierarchy, scale, poly count) → rename pieces to a deterministic scheme (`white_pawn`, `black_knight`, …) → export single GLB with embedded textures (`-b -o out.glb --export-format GLB`).
- Recommended usage: the single source of truth for all 32 pieces. One GLB, per-piece name lookup at runtime.

Status: PENDING Blender install → conversion in Phase 2.

## 2. kenney_modular-dungeon-kit_1.0  (environment)

Contents: 40 GLB modular parts (rooms, corridors, gates, stairs, wall/floor templates), plus OBJ/FBX mirrors and `Models/Textures/variation-a.png`, `variation-b.png`. Previews for every part.
Source: Kenney — "Modular Dungeon Kit (2.1)", distributed 24-02-2026.
License: **CC0** (License.txt, http://creativecommons.org/publicdomain/zero/1.0/).
- Redistributable: YES (public domain).
- Modifiable: YES.
- Browser: YES — GLB files with embedded textures load directly in Three.js.
- Required conversion: none. We will hand-pick a small number of parts (a room shell + floor templates + wall details) to keep draw calls and polycount low; the rest of the 40 modules stay unused (rule: no random asset stuffing).
- Recommended usage: `room-*` or `template-*` parts assembled into a single chamber behind the board; wall/door elements for framing. Credit Kenney in `CREDITS.md` (optional per CC0, done anyway).

## 3. kenney_particle-pack  (VFX sprites)

Contents: ~80 sprite PNGs in two folders — `PNG (Black background)` (solid black) and `PNG (Transparent)` (alpha). Series: circle, dirt, fire, flame, flare, light, magic, muzzle, scorch, scratch, slash, smoke, spark, star, symbol, trace, twirl, window.
Source: Kenney — "Particle Pack (1.1)".
License: **CC0** (License.txt).
- Redistributable: YES. Modifiable: YES. Browser: YES.
- Required conversion: copy the subset we actually use to `public/particles/` (transparent variant).
- Recommended usage:
  - `magic_*` / `star_*` → piece-select glow + check effects
  - `spark_*` → capture impact sparks
  - `flame_*` / `fire_*` → torch flicker sprites
  - `circle_*` / `light_*` → selection ring / halo
  - `trace_*` / `slash_*` → capture trail
  - `smoke_*` → capture smoke puff
  Cap simultaneous sprites (≤ ~120 live particles).

## 4. kenney_smoke-particles  (VFX sprites, sequences)

Contents: 5 sprite-sheet sequences (25–25 frames each): Black smoke (25), Explosion (9), Fart (9 — not used), Flash (9), White puff (25).
Source: Kenney. License: **CC0** (license.txt).
- Redistributable: YES. Modifiable: YES. Browser: YES.
- Required conversion: copy selected frames to `public/particles/`.
- Recommended usage: `White puff` frames for capture impact puffs and ambient dust; `Flash` for the single check flash. Black smoke too dark for the warm palette — skip.

## 5. nebula-src  (VERDICT: NOT USED)

Contents: a standalone demo — `index.html` + `styles.css` + `three.min.js` (old r*) + `postprocessing.min.js` (old `POSTPROCESSING.*` API) + `Logo.png` + `smoke.png` + `stars.jpg`.
What it actually is: the "Nebula" background demo of the **Red Stapler** SaaS login page — a rotating star-field (`stars.jpg`, 5647×3770) with drifting smoke planes, post-processing bloom + color-dodge, behind a login form.
License: **no license file**; the code is a company demo page (Red Stapler). `stars.jpg` is a photographic/CG render with unclear provenance.
- Browser: the bundled `three.min.js` is an old version and the `POSTPROCESSING.*` API is incompatible with modern Three.js — cannot be integrated without a rewrite.
- Legal: license of `stars.jpg` and the bundled demo is **unclear** → per project rules, assets with unclear licenses are excluded.
- Technical: nothing it does that we cannot do better: modern Three.js `UnrealBloomPass` + `Points` + a procedural shader give us nebula/atmosphere with full control and zero legal ambiguity.
- **Decision: do NOT integrate.** Documented here for audit completeness; the folder is left untouched and excluded from the build.

---

## Asset budget (planned)

- 1 × chess GLB (~1–3 MB, 2K textures, embedded)
- ≤ 6 × dungeon GLB parts (~2–3 MB)
- ~15 × particle PNG sprites (copied, 256–512 px)
- Total initial load target: < 8 MB.
