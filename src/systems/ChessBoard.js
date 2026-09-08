/**
 * ChessBoard — manages the board grid, highlights, raycast targets.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

export class ChessBoard {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.squares = [];           // [row][col] -> Mesh
    this.squareMap = {};         // squareId -> Mesh
    this.raycastTargets = [];
  }

  build(loadedBoardMesh) {
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;

    // Base: GLB board (already seated by Game._tryLoadBoardGLB) or procedural.
    if (loadedBoardMesh) {
      loadedBoardMesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      this.group.add(loadedBoardMesh);
    } else {
      this._buildBase(S, OFFSET);
    }

    // Overlay squares for interaction + highlights.
    for (let row = 0; row < 8; row++) {
      this.squares[row] = [];
      for (let col = 0; col < 8; col++) {
        const sq = new THREE.Mesh(
          new THREE.PlaneGeometry(S, S),
          new THREE.MeshStandardMaterial({
            color: (row + col) % 2 === 0 ? CFG.COLORS.boardLight : CFG.COLORS.boardDark,
            roughness: 0.80,
            metalness: 0.05,
            transparent: false,
          })
        );
        const x = col * S - OFFSET;
        const z = row * S - OFFSET; // rank 1 (row 7) at +Z (near camera), rank 8 (row 0) at -Z (far)
        sq.position.set(x, CFG.BOARD_OFFSET_Y + 0.005, z);
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
    this.sceneGroup = this.group;
    this.scene.add(this.group);
  }

  _buildBase(S, OFFSET) {
    const mat = new THREE.MeshStandardMaterial({
      color: CFG.COLORS.daisStone, roughness: 0.85, metalness: 0.1,
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
    return new THREE.Vector3(col * S - OFFSET, CFG.BOARD_OFFSET_Y + 0.01, row * S - OFFSET);
  }

  highlightSquare(id, color, durationMs = 600) {
    const sq = this.squareMap[id];
    if (!sq) return;
    sq.material.emissive.copy(color ?? CFG.COLORS.highlight);
    sq.material.emissiveIntensity = 0.55;
    setTimeout(() => {
      if (sq.material) sq.material.emissiveIntensity = 0;
    }, durationMs);
  }

  clearAllHighlights() {
    for (const row of this.squares)
      for (const sq of row)
        if (sq?.material) sq.material.emissiveIntensity = 0;
  }

  highlightLegalMoves(moves, color = CFG.COLORS.legalMove) {
    this.clearAllHighlights();
    for (const id of moves) {
      const sq = this.squareMap[id];
      if (!sq) continue;
      sq.material.emissive.copy(color);
      sq.material.emissiveIntensity = 0.3;
    }
  }

  resetHighlights() {
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = this.squares[row][col];
        if (!sq || !sq.material) continue;
        const light = (row + col) % 2 === 0;
        sq.material.color.copy(light ? CFG.COLORS.boardLight : CFG.COLORS.boardDark);
        sq.material.emissive.setHex(0x000000);
        sq.material.emissiveIntensity = 0;
      }
    }
  }
}