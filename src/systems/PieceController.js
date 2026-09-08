/**
 * PieceController — manages chess piece meshes, selection, movement.
 * 
 * Key design decisions:
 * - Loads chess_set.glb once; extracts one prototype Group per (type,color) from named nodes.
 * - Prototypes are TRANSFORMED CLONES of their source node — we strip parent transforms so each
 *   instance starts at origin and only carries the original mesh's geometry + materials.
 * - Materials are CLONED per prototype so one prototype's highlight does not cascade to others.
 * - Board scale factor bridges the GLB's ~0.55 m board size to our 8 u playfield.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

const PIECE_NAMES = [
  'king', 'queen', 'rook', 'bishop', 'knight', 'pawn',
];
const TYPE_REVERSE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function parsePieceName(name) {
  // e.g. "piece_king_white", "piece_pawn_black_03"
  const m = name.match(/^piece_([a-z]+)_(white|black)(?:_\d+)?$/i);
  if (!m) return null;
  return { type: m[1].toLowerCase(), color: m[2].toLowerCase() };
}

/**
 * Build one prototype Group per (type, color).
 * We clone the SOURCE NODE (not its children directly) so that:
 *  - the GLB's local origin is preserved in the clone, and
 *  - any scale/rotation baked into the source node's matrix does NOT bleed into instances.
 */
function buildProtos(gltf) {
  const protos = new Map(); // "type_color" -> Group
  const used = new Set();

  for (const child of gltf.scene.children) {
    const info = parsePieceName(child.name);
    if (!info) continue;
    const key = `${info.type}_${info.color}`;
    if (used.has(key)) continue;
    used.add(key);

    // Clone the node itself — it becomes the prototype container.
    // Its meshes will share material clones; the node's own matrix is identity.
    const protoGroup = child.clone();
    protoGroup.name = `proto_${key}`;

    // Clone every material so highlights don't cascade between prototypes.
    protoGroup.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
      }
    });

    // Scale to playfield units (board 0.55m -> 8u, i.e. ×CFG.SET_SCALE).
    // Then re-align the base to sit on y=0.
    protoGroup.scale.setScalar(CFG.SET_SCALE);
    const bb = new THREE.Box3().setFromObject(protoGroup);
    const baseY = -bb.min.y;
    protoGroup.position.y = baseY;

    protos.set(key, { group: protoGroup, baseY });
  }

  return protos;
}

export class PieceController {
  constructor(scene, assetMgr) {
    this.scene = scene;
    this.assetMgr = assetMgr;
    this.pieces = new Map();      // squareId -> THREE.Group (instance)
    this.selected = null;
    this.protos = new Map();      // "type_color" -> { group, baseY }
    this.loaded = false;
  }

  async loadAndSetup(fen) {
    const gltf = await this.assetMgr.loadGLB('assets/models/chess_set.glb');
    console.log('[Pieces] GLB loaded, children:', gltf.scene.children.length);
    this.protos = buildProtos(gltf);
    console.log('[Pieces] protos built:', [...this.protos.keys()].join(', '));
    this.loaded = true;
    this.placeFromFEN(fen);
  }

  placeFromFEN(fen) {
    // Remove existing instances.
    for (const [, g] of this.pieces) this.scene.remove(g);
    this.pieces.clear();
    this.selected = null;

    const [piecesStr] = fen.split(' ');
    const ranks = piecesStr.split('/');
    for (let r = 0; r < 8; r++) {
      const rankNum = 8 - r; // r=0 is rank 8 (black side), r=7 is rank 1 (white side)
      const rankStr = ranks[r];
      let col = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) {
          col += parseInt(ch, 10);
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          const type = ch.toLowerCase();
          const squareId = `${String.fromCharCode(97 + col)}${rankNum}`;
          this._place(type, color, squareId);
          col++;
        }
      }
    }
  }

  _place(type, color, squareId) {
    const fullColor = color === 'w' ? 'white' : 'black';
    const key = `${TYPE_REVERSE[type] || type}_${fullColor}`;
    const group = new THREE.Group();
    group.userData = { isPiece: true, type, color, squareId };

    const proto = this.protos.get(key);
    if (proto) {
      const inst = proto.group.clone();
      group.add(inst);
    } else {
      group.add(this._fallback(type, color));
    }

    const p = this._squarePos(squareId);
    group.position.copy(p);

    // Knights in the GLB were modeled facing away from their enemy.
    // Rotate knights by 180 degrees so their snouts face forward into the battlefield!
    if (type === 'n') {
      group.rotation.y = Math.PI;
    }

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

  _fallback(type, color) {
    const isW = color === 'w';
    const mat = new THREE.MeshStandardMaterial({
      color: isW ? CFG.COLORS.whitePiece : CFG.COLORS.blackPiece,
      roughness: isW ? 0.25 : 0.85,
      metalness: isW ? 0.4 : 0.1,
    });
    const map = {
      p: [new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16), 0.06],
      r: [new THREE.CylinderGeometry(0.2, 0.26, 0.6, 12), 0.3],
      n: [new THREE.ConeGeometry(0.2, 0.55, 12), 0.27],
      b: [new THREE.ConeGeometry(0.18, 0.75, 12), 0.37],
      q: [new THREE.CylinderGeometry(0.12, 0.2, 0.95, 12), 0.47],
      k: [new THREE.CylinderGeometry(0.14, 0.22, 1.1, 12), 0.55],
    };
    const [geo, y] = map[type] || map.p;
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    g.add(m);
    return g;
  }

  _squarePos(id) {
    const col = id.charCodeAt(0) - 97;
    const row = 8 - parseInt(id[1]);
    const S = CFG.SQUARE_SIZE;
    const OFF = (S * 8) / 2 - S / 2;
    return new THREE.Vector3(col * S - OFF, CFG.BOARD_OFFSET_Y + 0.01, row * S - OFF);
  }

  select(squareId) {
    if (this.selected && this.selected !== squareId) this._highlight(this.selected, false);
    this.selected = squareId;
    this._highlight(squareId, true);
  }

  deselect() {
    if (this.selected) { this._highlight(this.selected, false); this.selected = null; }
  }

  _highlight(squareId, on) {
    const g = this.pieces.get(squareId);
    if (!g) return;
    g.traverse(c => {
      if (c.isMesh && c.material && c.material.emissive) {
        c.material.emissive.setHex(on ? CFG.COLORS.selected : 0x000000);
        c.material.emissiveIntensity = on ? 0.35 : 0;
      }
    });
  }

  async movePiece(from, to) {
    const mesh = this.pieces.get(from);
    if (!mesh) return false;
    const dest = this._squarePos(to);
    const start = performance.now();
    const fromPos = mesh.position.clone();
    const arcH = 0.55;

    return new Promise(resolve => {
      const tick = () => {
        const t = Math.min((performance.now() - start) / CFG.ANIM.MOVE_DUR, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const target = new THREE.Vector3().lerpVectors(fromPos, dest, e);
        target.y += Math.sin(t * Math.PI) * arcH;
        mesh.position.copy(target);
        if (t < 1) requestAnimationFrame(tick);
        else {
          mesh.position.copy(dest);
          this.pieces.delete(from);
          mesh.userData.squareId = to;
          this.pieces.set(to, mesh);
          resolve(true);
        }
      };
      tick();
    });
  }

  get(squareId) {
    return this.pieces.get(squareId);
  }

  has(squareId) {
    return this.pieces.has(squareId);
  }

  replacePiece(squareId, type, color) {
    const oldMesh = this.pieces.get(squareId);
    if (oldMesh) {
      this.scene.remove(oldMesh);
      this.pieces.delete(squareId);
    }
    return this._place(type, color, squareId);
  }

  captureMesh(mesh) {
    if (!mesh) return;
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / CFG.ANIM.CAPTURE_DUR, 1);
      mesh.scale.setScalar(1 - t);
      mesh.traverse(c => { if (c.isMesh && c.material) c.material.transparent = true; });
      if (t < 1) requestAnimationFrame(tick);
      else {
        this.scene.remove(mesh);
      }
    };
    tick();
  }
}