/**
 * ChessBoard — manages the board grid, highlights, and piece placement.
 * Supports both the GLB-loaded board mesh AND programmatic square overlays.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

// Square color cycle for highlighting: highlight -> legal -> capture -> back
const HIGHLIGHT_COLOR = new THREE.Color(CFG.COLORS.highlight);
const LEGAL_COLOR     = new THREE.Color(0x3a6b3a);
const SELECTED_COLOR  = new THREE.Color(0xc9a84c);

export class ChessBoard {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    // [row][col] -> Mesh (the square overlay)
    this.squares = [];
    // [squareId] -> Mesh
    this.squareMap = {};
    this.raycastTargets = [];
  }

  build(loadedBoardMesh) {
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;

    // If a GLB board mesh was loaded, add it as base. Otherwise create procedural.
    if (loadedBoardMesh) {
      this.group.add(loadedBoardMesh);
    } else {
      this._buildBase(S, OFFSET);
    }

    // Overlay squares for interaction + highlight
    for (let row = 0; row < 8; row++) {
      this.squares[row] = [];
      for (let col = 0; col < 8; col++) {
        const sq = new THREE.Mesh(
          new THREE.PlaneGeometry(S, S),
          new THREE.MeshStandardMaterial({
            color: (row + col) % 2 === 0 ? 0xd4b896 : 0x3d2b1f,
            roughness: 0.75,
            metalness: 0.15,
            transparent: true,
            opacity: 0.88,
          })
        );
        const x = col * S - OFFSET;
        const z = -(row * S - OFFSET); // flip Z so a1 is bottom-left
        sq.position.set(x, CFG.BOARD_OFFSET_Y + 0.002, z);
        sq.rotation.x = -Math.PI / 2;
        const id = `${String.fromCharCode(97 + col)}${8 - row}`;
        sq.userData = { type: 'square', id, row, col };
        sq.receiveShadow = true;
        this.group.add(sq);
        this.squares[row][col] = sq;
        this.squareMap[id] = sq;
        this.raycastTargets.push(sq);
      }
    }

    // Add all group children to raycast targets (for pieces)
    this.sceneGroup = this.group;
    this.scene.add(this.group);
  }

  _buildBase(S, OFFSET) {
    // Procedural stone board surface
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3d3228, roughness: 0.85, metalness: 0.1,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(S * 8 + 0.4, 0.05, S * 8 + 0.4), mat);
    base.position.y = CFG.BOARD_OFFSET_Y;
    base.receiveShadow = true;
    base.castShadow = true;
    this.group.add(base);
  }

  getSquare(id) { return this.squareMap[id]; }

  getSquarePos(id) {
    const col = id.charCodeAt(0) - 97;
    const row = 8 - parseInt(id[1]);
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;
    return new THREE.Vector3(col * S - OFFSET, CFG.BOARD_OFFSET_Y + 0.01, -(row * S - OFFSET));
  }

  highlightSquare(id, color, durationMs = 600) {
    const sq = this.squareMap[id];
    if (!sq) return;
    sq.material.emissive = color || HIGHLIGHT_COLOR;
    sq.material.emissiveIntensity = 0.55;
    setTimeout(() => {
      if (sq.material) { sq.material.emissiveIntensity = 0; }
    }, durationMs);
  }

  clearAllHighlights() {
    for (const row of this.squares)
      for (const sq of row)
        if (sq?.material) sq.material.emissiveIntensity = 0;
  }

  highlightLegalMoves(moves, color = LEGAL_COLOR) {
    this.clearAllHighlights();
    moves.forEach(id => {
      const sq = this.squareMap[id];
      if (!sq) return;
      sq.material.color.lerp(color, 0.35);
      sq.material.emissive = color;
      sq.material.emissiveIntensity = 0.3;
    });
  }

  resetHighlights() {
    for (const row of this.squares)
      for (const sq of row) {
        if (!sq.material) continue;
        const key = sq.userData.id;
        if (key) {
          const col = key.charCodeAt(0) - 97;
          const row2 = 8 - parseInt(key[1]);
          sq.material.color.set((row2 + col) % 2 === 0 ? 0xd4b896 : 0x3d2b1f);
          sq.material.emissive.setHex(0x000000);
          sq.material.emissiveIntensity = 0;
        }
      }
  }
}
