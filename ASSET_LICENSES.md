# ASSET LICENSES — Medieval 3D Chess (Day 4)

Rule for this project: **never use an asset whose license is unclear.**

| Asset | License | Evidence | Redistribute | Modify | Attribution required? |
|-------|---------|----------|--------------|--------|------------------------|
| Modular Dungeon Kit 2.1 (Kenney) | CC0 1.0 | `kenney_modular-dungeon-kit_1.0/License.txt` | Yes | Yes | Not required; credited in CREDITS.md anyway |
| Particle Pack 1.1 (Kenney) | CC0 1.0 | `kenney_particle-pack/License.txt` | Yes | Yes | Not required; credited in CREDITS.md anyway |
| Smoke Particles (Kenney) | CC0 1.0 | `kenney_smoke-particles/license.txt` | Yes | Yes | Not required; credited in CREDITS.md anyway |
| chess_set_2k.blend | **Unverified** (no license file in package) | Absence of any license file | Derived GLB ships only in our repo (no external redistribution) | Yes | Unknown — flagged; if the user identifies the source, add the required credit |
| nebula-src | **Unclear** (no license file; Red Stapler demo; bundled three.min.js + postprocessing.min.js are old copies) | No license file in `nebula-src/` | No | No | — |

## Decisions

- **Kenney (3 packs)**: safe to use, modify, and ship. CC0 = public domain; no conditions. Credit added as courtesy.
- **chess_set_2k.blend**: no license file shipped. It is a working input file provided by the user. We convert it to a GLB derivative that ships inside this project repo. We do **not** redistribute the original .blend or its source textures publicly. If the user can identify the original source, the appropriate attribution is added to `CREDITS.md` before any public release.
- **nebula-src**: excluded entirely — unclear license + old incompatible code + unclear provenance of `stars.jpg`. Not referenced by the build.

## Third-party code licenses (npm)

| Package | Version | License |
|---------|---------|---------|
| three | ^0.166 | MIT |
| chess.js | ^1.0.0 | MIT |
| vite | ^5.3 | MIT |

All MIT — safe for any use, attribution retained in `node_modules` / license headers.
