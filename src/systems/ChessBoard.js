/**
 * ChessBoard — manages the board grid, highlights, raycast targets.
 * Added: persistent last-move highlight, hover glow, board flip rotation.
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
    this.lastMoveFrom = null;
    this.lastMoveTo = null;
    this.hoverSquareId = null;
  }

  build(loadedBoardMesh) {
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;

    if (loadedBoardMesh) {
      loadedBoardMesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
      this.group.add(loadedBoardMesh);
    } else {
      this._buildBase(S, OFFSET);
    }

    // Overlay squares
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
        const z = row * S - OFFSET;
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

    // Coordinate labels (a-h, 1-8) on the board edges
    this._buildCoordinateLabels(S, OFFSET);
  }

  _buildCoordinateLabels(S, OFFSET) {
    const files = 'abcdefgh';
    const labelColor = '#6b5b4a';
    const fontSize = 48;

    for (let i = 0; i < 8; i++) {
      // File labels (a-h) along bottom edge
      const fileCanvas = this._makeLabel(files[i], fontSize, labelColor);
      const fileTex = new THREE.CanvasTexture(fileCanvas);
      fileTex.colorSpace = THREE.SRGBColorSpace;
      const fileMat = new THREE.SpriteMaterial({ map: fileTex, transparent: true, opacity: 0.7 });
      const fileSprite = new THREE.Sprite(fileMat);
      fileSprite.position.set(i * S - OFFSET, CFG.BOARD_OFFSET_Y + 0.02, OFFSET + S * 0.65);
      fileSprite.scale.set(0.35, 0.35, 1);
      this.group.add(fileSprite);

      // Rank labels (1-8) along left edge
      const rankCanvas = this._makeLabel(String(8 - i), fontSize, labelColor);
      const rankTex = new THREE.CanvasTexture(rankCanvas);
      rankTex.colorSpace = THREE.SRGBColorSpace;
      const rankMat = new THREE.SpriteMaterial({ map: rankTex, transparent: true, opacity: 0.7 });
      const rankSprite = new THREE.Sprite(rankMat);
      rankSprite.position.set(-OFFSET - S * 0.65, CFG.BOARD_OFFSET_Y + 0.02, i * S - OFFSET);
      rankSprite.scale.set(0.35, 0.35, 1);
      this.group.add(rankSprite);
    }
  }

  _makeLabel(text, fontSize, color) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = color;
    ctx.font = `${fontSize}px 'Palatino Linotype', Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 34);
    return cv;
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
    // Apply group rotation to the position
    const localPos = new THREE.Vector3(col * S - OFFSET, CFG.BOARD_OFFSET_Y + 0.01, row * S - OFFSET);
    return localPos.applyEuler(this.group.rotation);
  }

  // ─── PERSISTENT LAST MOVE HIGHLIGHT ───────────────────────────
  setLastMove(from, to) {
    this.clearLastMove();
    this.lastMoveFrom = from;
    this.lastMoveTo = to;
    const sqFrom = this.squareMap[from];
    const sqTo = this.squareMap[to];
    if (sqFrom) {
      sqFrom.material.emissive.copy(CFG.COLORS.highlight);
      sqFrom.material.emissiveIntensity = 0.35;
    }
    if (sqTo) {
      sqTo.material.emissive.copy(CFG.COLORS.highlight);
      sqTo.material.emissiveIntensity = 0.45;
    }
  }

  clearLastMove() {
    if (this.lastMoveFrom) {
      const sq = this.squareMap[this.lastMoveFrom];
      if (sq && sq.material) sq.material.emissiveIntensity = 0;
    }
    if (this.lastMoveTo) {
      const sq = this.squareMap[this.lastMoveTo];
      if (sq && sq.material) sq.material.emissiveIntensity = 0;
    }
    this.lastMoveFrom = null;
    this.lastMoveTo = null;
  }

  // ─── HOVER ────────────────────────────────────────────────────
  setHover(id, on) {
    const sq = this.squareMap[id];
    if (!sq) return;
    if (on) {
      sq.material.emissive.setHex(0x886622);
      sq.material.emissiveIntensity = 0.25;
      this.hoverSquareId = id;
    } else {
      // Restore: if it's a last-move square, keep that highlight
      if (id === this.lastMoveFrom || id === this.lastMoveTo) {
        sq.material.emissive.copy(CFG.COLORS.highlight);
        sq.material.emissiveIntensity = id === this.lastMoveTo ? 0.45 : 0.35;
      } else {
        sq.material.emissiveIntensity = 0;
      }
      if (this.hoverSquareId === id) this.hoverSquareId = null;
    }
  }

  // ─── BOARD FLIP ───────────────────────────────────────────────
  setRotation(yRad) {
    this.group.rotation.y = yRad;
  }

  highlightSquare(id, color, durationMs = 600) {
    const sq = this.squareMap[id];
    if (!sq) return;
    sq.material.emissive.copy(color ?? CFG.COLORS.highlight);
    sq.material.emissiveIntensity = 0.55;
    setTimeout(() => {
      if (sq.material) {
        // Don't reset if it's a last-move square
        if (id === this.lastMoveFrom || id === this.lastMoveTo) {
          sq.material.emissive.copy(CFG.COLORS.highlight);
          sq.material.emissiveIntensity = id === this.lastMoveTo ? 0.45 : 0.35;
        } else {
          sq.material.emissiveIntensity = 0;
        }
      }
    }, durationMs);
  }

  clearAllHighlights() {
    for (const row of this.squares)
      for (const sq of row)
        if (sq?.material) sq.material.emissiveIntensity = 0;
  }

  highlightLegalMoves(moves, color = CFG.COLORS.legalMove) {
    // Don't clear last-move highlight; only clear legal move highlights
    for (const row of this.squares) {
      for (const sq of row) {
        if (!sq?.material) continue;
        const id = sq.userData.id;
        // Keep last-move highlights
        if (id === this.lastMoveFrom || id === this.lastMoveTo) continue;
        sq.material.emissiveIntensity = 0;
      }
    }
    for (const id of moves) {
      const sq = this.squareMap[id];
      if (!sq) continue;
      sq.material.emissive.copy(color);
      sq.material.emissiveIntensity = 0.3;
    }
  }

  resetHighlights() {
    const S = CFG.SQUARE_SIZE;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = this.squares[row][col];
        if (!sq || !sq.material) continue;
        const light = (row + col) % 2 === 0;
        sq.material.color.copy(light ? CFG.COLORS.boardLight : CFG.COLORS.boardDark);
        const id = sq.userData.id;
        // Preserve last-move highlights
        if (id === this.lastMoveFrom || id === this.lastMoveTo) {
          sq.material.emissive.copy(CFG.COLORS.highlight);
          sq.material.emissiveIntensity = id === this.lastMoveTo ? 0.45 : 0.35;
        } else {
          sq.material.emissive.setHex(0x000000);
          sq.material.emissiveIntensity = 0;
        }
      }
    }
  }
}
