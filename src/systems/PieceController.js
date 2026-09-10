/**
 * PieceController — manages chess piece meshes, selection, movement.
 * Added: hover glow, board flip rotation, memory-safe captureMesh.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

const PIECE_NAMES = [
  'king', 'queen', 'rook', 'bishop', 'knight', 'pawn',
];
const TYPE_REVERSE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };

function parsePieceName(name) {
  const m = name.match(/^piece_([a-z]+)_(white|black)(?:_\d+)?$/i);
  if (!m) return null;
  return { type: m[1].toLowerCase(), color: m[2].toLowerCase() };
}

function buildProtos(gltf) {
  const protos = new Map();
  const used = new Set();

  for (const child of gltf.scene.children) {
    const info = parsePieceName(child.name);
    if (!info) continue;
    const key = `${info.type}_${info.color}`;
    if (used.has(key)) continue;
    used.add(key);

    const protoGroup = child.clone();
    protoGroup.name = `proto_${key}`;

    protoGroup.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = c.material.clone();
      }
    });

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
    this.hovered = null;
    this.protos = new Map();      // "type_color" -> { group, baseY }
    this.loaded = false;
    this.piecesGroup = new THREE.Group(); // container for flip rotation
    this.scene.add(this.piecesGroup);

    // Drag shadow disc (reusable)
    this.dragShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.35, 24),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.4,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    this.dragShadow.rotation.x = -Math.PI / 2;
    this.dragShadow.visible = false;
    this.scene.add(this.dragShadow);
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
    // Remove existing instances
    for (const [, g] of this.pieces) {
      this.piecesGroup.remove(g);
      this._disposeGroup(g);
    }
    this.pieces.clear();
    this.selected = null;

    const [piecesStr] = fen.split(' ');
    const ranks = piecesStr.split('/');
    for (let r = 0; r < 8; r++) {
      const rankNum = 8 - r;
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
      // Clone materials for isolation
      inst.traverse(c => {
        if (c.isMesh && c.material) c.material = c.material.clone();
      });
      group.add(inst);
    } else {
      group.add(this._fallback(type, color));
    }

    const p = this._squarePos(squareId);
    group.position.copy(p);

    // Knights face forward
    if (type === 'n') {
      group.rotation.y = Math.PI;
    }

    group.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    this.piecesGroup.add(group);
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

  // ─── SELECTION ────────────────────────────────────────────────
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
        c.material.emissive.setHex(on ? 0xffcc00 : 0x000000);
        c.material.emissiveIntensity = on ? 0.35 : 0;
      }
    });
  }

  // ─── HOVER ────────────────────────────────────────────────────
  setHover(squareId, on) {
    const g = this.pieces.get(squareId);
    if (!g) return;
    if (on && squareId !== this.selected) {
      g.traverse(c => {
        if (c.isMesh && c.material && c.material.emissive) {
          c.material.emissive.setHex(0x886622);
          c.material.emissiveIntensity = 0.2;
        }
      });
      this.hovered = squareId;
    } else if (!on && squareId !== this.selected) {
      g.traverse(c => {
        if (c.isMesh && c.material && c.material.emissive) {
          c.material.emissive.setHex(0x000000);
          c.material.emissiveIntensity = 0;
        }
      });
      if (this.hovered === squareId) this.hovered = null;
    }
  }

  // ─── BOARD FLIP ───────────────────────────────────────────────
  setRotation(yRad) {
    this.piecesGroup.rotation.y = yRad;
  }

  // ─── DRAG SHADOW ─────────────────────────────────────────────
  showDragShadow(x, z) {
    this.dragShadow.position.set(x, CFG.BOARD_OFFSET_Y + 0.008, z);
    this.dragShadow.visible = true;
  }

  hideDragShadow() {
    this.dragShadow.visible = false;
  }

  updateDragShadow(x, z) {
    if (this.dragShadow.visible) {
      this.dragShadow.position.x = x;
      this.dragShadow.position.z = z;
    }
  }

  // ─── MOVE ANIMATION ──────────────────────────────────────────
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
      this.piecesGroup.remove(oldMesh);
      this._disposeGroup(oldMesh);
      this.pieces.delete(squareId);
    }
    return this._place(type, color, squareId);
  }

  // ─── CAPTURE WITH FULL DISPOSE (memory leak fix) ──────────────
  captureMesh(mesh) {
    if (!mesh) return;
    // Remove from pieces map
    for (const [key, val] of this.pieces) {
      if (val === mesh) { this.pieces.delete(key); break; }
    }
    const start = performance.now();
    const tick = () => {
      const t = Math.min((performance.now() - start) / CFG.ANIM.CAPTURE_DUR, 1);
      mesh.scale.setScalar(1 - t);
      mesh.traverse(c => { if (c.isMesh && c.material) c.material.transparent = true; });
      if (t < 1) requestAnimationFrame(tick);
      else {
        this.piecesGroup.remove(mesh);
        this._disposeGroup(mesh);
      }
    };
    tick();
  }

  // ─── DEEP DISPOSE (fix memory leaks) ──────────────────────────
  _disposeGroup(group) {
    group.traverse(c => {
      if (c.isMesh) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) {
            c.material.forEach(m => {
              if (m.map) m.map.dispose();
              if (m.normalMap) m.normalMap.dispose();
              if (m.roughnessMap) m.roughnessMap.dispose();
              m.dispose();
            });
          } else {
            if (c.material.map) c.material.map.dispose();
            if (c.material.normalMap) c.material.normalMap.dispose();
            if (c.material.roughnessMap) c.material.roughnessMap.dispose();
            c.material.dispose();
          }
        }
      }
    });
  }
}
