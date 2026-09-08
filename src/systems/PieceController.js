/**
 * PieceController — manages chess piece meshes, selection, movement animation.
 * Loads the chess_set.glb once, clones per-position instances.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';
import { AssetManager } from '../engine/AssetManager.js';

// Map GLB node names -> chess piece type & color
// Expected names from export: piece_king_white, piece_queen_black, piece_pawn_white_01, ...
function parsePieceName(name) {
  // piece_{type}_{color}[_idx]?
  const m = name.match(/^piece_(king|queen|rook|bishop|knight|pawn)_(white|black)(?:_(\d+))?$/i);
  if (!m) return null;
  return {
    type: m[1].toLowerCase(),
    color: m[2].toLowerCase(),
    idx: m[3] ? parseInt(m[3]) : 1,
  };
}

export class PieceController {
  constructor(scene, assetMgr) {
    this.scene = scene;
    this.assetMgr = assetMgr;
    // All live piece groups keyed by square id
    this.pieces = new Map();
    // Selected square id
    this.selected = null;
    // Animation queue
    this.pending = [];
    // GLB source object (cloned for each position)
    this.sourceMeshes = new Map(); // type_color -> THREE.Group (or Mesh)
  }

  async loadAndSetup(fen) {
    try {
      const gltf = await this.assetMgr.loadGLB('assets/models/chess_set.glb');
      console.log('[Pieces] GLB loaded, nodes:', gltf.scene.children.length);
      // Cache each named mesh for later cloning
      gltf.scene.traverse(child => {
        if (child.isMesh && child.name) {
          const info = parsePieceName(child.name);
          if (info) {
            const key = `${info.type}_${info.color}`;
            if (!this.sourceMeshes.has(key)) {
              // Clone the mesh so we don't modify the source
              const clone = child.clone();
              clone.name = child.name;
              clone.material = child.material.clone();
              this.sourceMeshes.set(key, clone);
              // Center/zero the mesh for clean transforms
              const bb = new THREE.Box3().setFromObject(clone);
              const center = new THREE.Vector3();
              bb.getCenter(center);
              clone.position.sub(center);
              clone.position.y += 0.02; // small offset so base sits at y=0
              this.scene.add(clone); // keep as invisible prototype
            }
          }
        }
      });
      console.log('[Pieces] Cached source meshes:', Array.from(this.sourceMeshes.keys()));
    } catch (e) {
      console.warn('[Pieces] Failed to load chess set GLB, using fallback:', e);
    }
    this.placeFromFEN(fen);
  }

  placeFromFEN(fen) {
    // Clear existing
    this.pieces.forEach(p => {
      p.traverse(c => {
        if (c.isMesh && c.geometry) c.geometry.dispose();
        if (c.isMesh && c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
      this.scene.remove(p);
    });
    this.pieces.clear();
    this.selected = null;

    const [piecesStr] = fen.split(' ');
    let row = 7, col = 0;
    for (const ch of piecesStr) {
      if (ch === '/') { row--; col = 0; }
      else if (/\d/.test(ch)) { col += parseInt(ch); }
      else {
        const isWhite = ch === ch.toUpperCase();
        const type = ch.toLowerCase();
        const color = isWhite ? 'w' : 'b';
        const id = `${String.fromCharCode(97 + col)}${8 - row}`;
        this._placePiece(type, color, id);
        col++;
      }
    }
  }

  _placePiece(type, color, squareId) {
    const group = new THREE.Group();
    group.userData = { type, color, squareId, isPiece: true };

    // Find matching source by type+color
    const srcKey = `${type}_${color}`;
    const src = this.sourceMeshes.get(srcKey);
    if (src) {
      const instance = src.clone();
      instance.material = src.material.clone();
      group.add(instance);
    } else {
      // Fallback geometry (procedural)
      group.add(this._fallbackPieceMesh(type, color));
    }

    const pos = this._getSquarePos(squareId);
    group.position.copy(pos);
    group.position.y += 0.01; // sit on board

    group.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });

    this.scene.add(group);
    this.pieces.set(squareId, group);
    return group;
  }

  _fallbackPieceMesh(type, color) {
    const isWhite = color === 'w';
    const mat = new THREE.MeshStandardMaterial({
      color: isWhite ? CFG.COLORS.whitePiece : CFG.COLORS.blackPiece,
      roughness: isWhite ? 0.25 : 0.85,
      metalness: isWhite ? 0.4 : 0.1,
      emissive: 0x000000,
    });
    switch (type) {
      case 'p': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16), mat));
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat);
        b.position.y = 0.3; b.scale.y = 1.3; g.add(b);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), mat);
        h.position.y = 0.55; g.add(h);
        return g;
      }
      case 'r': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 16), mat));
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 12), mat);
        b.position.y = 0.35; g.add(b);
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8), mat);
        t.position.y = 0.61; g.add(t);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const c = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat);
          c.position.set(Math.cos(a) * 0.16, 0.7, Math.sin(a) * 0.16);
          g.add(c);
        }
        return g;
      }
      case 'n': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 16), mat));
        const b = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 12), mat);
        b.position.y = 0.38; g.add(b);
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.28), mat);
        h.position.set(0, 0.62, 0.06); h.rotation.x = -0.15; g.add(h);
        const sn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), mat);
        sn.position.set(0, 0.52, 0.18); g.add(sn);
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), mat);
        ear.position.set(0, 0.78, 0); g.add(ear);
        return g;
      }
      case 'b': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 16), mat));
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 12), mat);
        b.position.y = 0.41; g.add(b);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), mat);
        h.position.y = 0.72; h.scale.y = 1.4; g.add(h);
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
        kn.position.y = 0.86; g.add(kn);
        return g;
      }
      case 'q': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 16), mat));
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.55, 12), mat);
        b.position.y = 0.44; g.add(b);
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), mat);
        s.position.y = 0.74; s.scale.y = 0.6; g.add(s);
        const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.12, 8), mat);
        cr.position.y = 0.88; g.add(cr);
        const tp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat);
        tp.position.y = 1.0; g.add(tp);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const pt = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), mat);
          pt.position.set(Math.cos(a) * 0.14, 0.97, Math.sin(a) * 0.14);
          g.add(pt);
        }
        return g;
      }
      case 'k': {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.16, 16), mat));
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.58, 12), mat);
        b.position.y = 0.45; g.add(b);
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat);
        s.position.y = 0.78; s.scale.y = 0.55; g.add(s);
        const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.14, 8), mat);
        cr.position.y = 0.95; g.add(cr);
        const cv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), mat);
        cv.position.y = 1.12; g.add(cv);
        const ch = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), mat);
        ch.position.y = 1.16; g.add(ch);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat);
        tip.position.y = 1.26; g.add(tip);
        return g;
      }
      default:
        return new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
    }
  }

  _getSquarePos(id) {
    const col = id.charCodeAt(0) - 97;
    const row = 8 - parseInt(id[1]);
    const S = CFG.SQUARE_SIZE;
    const OFFSET = (S * 8) / 2 - S / 2;
    return new THREE.Vector3(col * S - OFFSET, 0, -(row * S - OFFSET));
  }

  select(squareId) {
    if (this.selected && this.selected !== squareId) {
      this._highlightPiece(this.selected, false);
    }
    this.selected = squareId;
    this._highlightPiece(squareId, true);
  }

  deselect() {
    if (this.selected) {
      this._highlightPiece(this.selected, false);
      this.selected = null;
    }
  }

  _highlightPiece(squareId, selected) {
    const g = this.pieces.get(squareId);
    if (!g) return;
    g.traverse(c => {
      if (c.isMesh && c.material) {
        c.material.emissive = selected ? new THREE.Color(CFG.COLORS.selected) : new THREE.Color(0x000000);
        c.material.emissiveIntensity = selected ? 0.3 : 0;
      }
    });
  }

  async movePiece(from, to) {
    const mesh = this.pieces.get(from);
    if (!mesh) return false;
    const dest = this._getSquarePos(to);

    // Animate with arc
    const dur = 350;
    const start = performance.now();
    const startPos = mesh.position.clone();
    const arcH = 0.6;

    return new Promise(resolve => {
      const tick = () => {
        const t = Math.min((performance.now() - start) / dur, 1);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        mesh.position.lerpVectors(startPos, dest, ease);
        mesh.position.y += Math.sin(t * Math.PI) * arcH + (dest.y - startPos.y) * ease;
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          mesh.position.copy(dest);
          mesh.position.y += 0.01;
          this.pieces.delete(from);
          mesh.userData.squareId = to;
          this.pieces.set(to, mesh);
          resolve(true);
        }
      };
      tick();
    });
  }

  captureAt(squareId) {
    const mesh = this.pieces.get(squareId);
    if (!mesh) return;
    const start = performance.now();
    const dur = 250;
    const origScale = mesh.scale.x;
    const tick = () => {
      const t = Math.min((performance.now() - start) / dur, 1);
      mesh.scale.setScalar(origScale * (1 - t));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.scene.remove(mesh);
        this.pieces.delete(squareId);
      }
    };
    tick();
  }
}
