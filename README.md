# 🏰 Medieval 3D Chess

A fully playable browser-based 3D chess game with a dark medieval atmosphere, built with Three.js and chess.js.

---

## 🎮 How to Play

1. **Open in browser**: http://localhost:4007/ (requires dev server — see Setup below)
2. **Click** a white piece to select it — glowing cyan magic runes will highlight all legal moves
3. **Click** a highlighted square to move there
4. Capture enemy pieces by moving onto their square (crimson ring = capture available)
5. Full chess rules enforced: castling, en passant, pawn promotion, check & checkmate detection

### Controls
- **Left-click + drag** — orbit camera around the board
- **Scroll wheel** — zoom in / out
- **Buttons**: New Game · Undo · Reset View

---

## ⚙️ Setup & Run

```bash
cd "D:/CODE/30 DAYS/DAY 4"
npm install          # install Three.js, chess.js, vite
npm run dev          # start dev server (port 4000 by default)
npm run build        # production build to dist/
npm run preview      # preview production build
```

---

## 📁 Project Structure

```
├── assets/
│   ├── env/room-small.glb            # Kenney Modular Dungeon Kit (CC0)
│   └── models/chess_set.glb          # Converted from chess_set_2k.blend (PBR)
├── public/assets/                    # Copied for Vite static serving
├── src/
│   ├── config.js                     # All constants (scale, colors, camera, timing)
│   ├── systems/
│   │   ├── Game.js                   # Main orchestrator: input, game loop, state
│   │   ├── ChessEngine.js            # chess.js wrapper (moves, history, status)
│   │   ├── ChessBoard.js             # 8×8 procedural square mesh overlay
│   │   ├── PieceController.js        # GLB piece loading, placement, selection, animation
│   │   ├── CameraController.js       # Cinematic intro → orbit → focus transitions
│   │   ├── Environment.js            # Dungeon room, rain particles, lightning flashes
│   │   ├── VFXController.js          # Magic rune rings, capture sparks, check rings
│   │   ├── AudioController.js        # Web Audio synthesized SFX (rain, thunder, bells)
│   │   ├── UIManager.js              # HUD: turn indicator, captures, history, modals
│   │   └── PromotionDialog.js        # Pawn promotion pick overlay
│   └── index.js                      # Entry point
├── _tools/                           # Blend/GLB inspection scripts
└── package.json
```

---

## 🎨 Assets & Licenses

| Asset | Source | License | Usage |
|---|---|---|---|
| `chess_set_2k.blend` | Kenney | CC0 | Converted to GLB (7.8 MB, 1K textures), used for all 32 chess pieces |
| `room-small.glb` | Kenney Modular Dungeon Kit | CC0 | Scaled 2×; serves as the medieval stone chamber environment |
| Particle sprites (`*.png`) | Kenney Particle Pack | CC0 | Used for spark, puff, magic effects via Three.js Sprites |

> All Kenney assets are under **Creative Commons Zero (CC0)** — free for any use including commercial projects. See `ASSET_LICENSES.md` for full attribution.

---

## 🔧 Technical Notes

- **GLB conversion**: Original `.blend` was converted via Blender CLI to `chess_set.glb` with 1K compressed PBR textures (diffuse + normal + roughness). The board stone slab is also included.
- **Board layout**: The GLB board (0.55m × 0.55m) is scaled 16.2× to frame an 8-unit playfield. 64 procedural square meshes sit on top with a dark gothic stone palette (`#7a746e` / `#1a1816`).
- **Knights orientation**: Rotated 180° so snouts face forward into enemy territory.
- **Raycaster fix**: When a piece is selected, clicked destinations are prioritized via `isLegal()` against board squares — prevents tall pieces blocking clicks on squares behind them.
- **Checkmate/Castling/En-passant/Promotion**: All validated via automated Playwright test suite (`qa_harness_v2.js`).

---

## Bugs Fixed (Recent)

- [x] **Silau/lighting** — spotlight reduced 320→28, tone-mapping exposure dropped to 0.70, bloom strength 0.20
- [x] **Panel kaca di tengah papan** — board scaling fixed (SET_SCALE 10→16.2), square opacity set to 1.0 solid
- [x] **Kuda ngadep kebalik** — Knight prototype group rotated π radians on Y-axis
- [x] **Rank inversion (FEN parsing)** — pawn placement now correctly maps FEN ranks to board coordinates
- [x] **Raycast picking behind tall pieces** — legal-move-square check takes priority when selecting

---

## Credits

- **Three.js** — https://threejs.org
- **chess.js** — https://github.com/jhlywa/chess.js
- **Kenney.nl** — modular dungeon kit, particle pack (CC0)
- **Blender** — GLB export toolchain

---

Built with ❤️ for Vincrescent Day 4 Challenge.
