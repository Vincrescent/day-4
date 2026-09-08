/**
 * Medieval 3D Chess — Modular Codebase
 *
 * Architecture:
 *   Game.js          — Main orchestrator, bootstraps everything
 *   ThreeJSEngine.js — Scene, camera, renderer, post-processing
 *   ChessEngine.js   — chess.js wrapper + game state
 *   AssetManager.js  — GLB/textures/particle loader
 *   Environment.js   — Dungeon chamber (Kenney kit + procedural)
 *   ChessBoard.js    — Board grid + piece placement
 *   PieceMesh.js     — Individual piece 3D representation
 *   CameraController.js — Cinematic intro + orbit controls
 *   VFXController.js — Spark/capture/smoke particle effects
 *   AudioController.js — Web Audio API sound effects
 *   UIManager.js     — DOM overlay management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import Chess from 'chess.js';

// ============================================================
// CONFIGURATION
// ============================================================
export const CFG = {
  // Dimensions
  SQUARE_SIZE: 1,
  BOARD_OFFSET_Y: 0.4,
  BOARD_SIZE: 8,

  // Colors
  COLORS: {
    boardLight:    0xd4b896,
    boardDark:     0x3d2b1f,
    frame:         0x4a3728,
    highlight:     0xc9a84c,
    legalMove:     0x7fff7f,
    selected:      0xffcc00,
    whitePiece:    0xf5e6c8,
    blackPiece:    0x1a1410,
    ambient:       0x1a1008,
    fog:           0x0a0500,
  },

  // Camera
  CAMERA: {
    INTRO_START:   new THREE.Vector3(0, 12, 18),
    INTRO_END:     new THREE.Vector3(0, 4, 7),
    INTRO_DUR:     4.0,   // seconds
    ORBIT_MIN:     3,
    ORBIT_MAX:     25,
    TILT:          0.35,
  },

  // Lighting
  LIGHTING: {
    ambient:    0x2a1f15,
    ambientI:   0.3,
    torch1:     0xffaa55,
    torch2:     0xff7733,
    boardGlow:  0x443322,
    shadowMapSize: 2048,
  },

  // Animation
  ANIM: {
    MOVE_DUR:  0.35,
    CAPTURE_DUR: 0.25,
    SELECT_SCALE: 1.04,
    LERP_SMOOTH: 8,
  },

  // Particles
  PARTICLES: {
    DUST_COUNT: 60,
    MAX_ACTIVE: 200,
  },
};

// ============================================================
// THREE.JS ENGINE
// ============================================================
export class ThreeJSEngine {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CFG.COLORS.fog);
    this.scene.fog = new THREE.FogExp2(CFG.COLORS.fog, 0.025);

    this.camera = new THREE.PerspectiveCamera(
      55, window.innerWidth / window.innerHeight, 0.1, 200
    );
    this.camera.position.copy(CFG.CAMERA.INTRO_START);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.appendChild(this.renderer.domElement);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.4, 0.5, 0.85
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = CFG.CAMERA.ORBIT_MIN;
    this.controls.maxDistance = CFG.CAMERA.ORBIT_MAX;
    this.controls.target.set(0, CFG.BOARD_OFFSET_Y + 0.5, 0);
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.enabled = false; // disabled during intro

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  }

  render() {
    this.composer.render();
  }
}

// ============================================================
// CHESS ENGINE (chess.js wrapper)
// ============================================================
export class ChessEngine {
  constructor() {
    this.game = new Chess();
    this.moveHistory = [];
    this.captured = { w: [], b: [] };
  }

  reset() {
    this.game.reset();
    this.moveHistory = [];
    this.captured = { w: [], b: [] };
  }

  move(from, to, promo = 'q') {
    const result = this.game.move({ from, to, promotion: promo });
    if (!result) return null;
    this.moveHistory.push(result.san);
    if (result.captured) {
      const side = result.color === 'w' ? 'b' : 'w'; // captured piece belongs to opponent
      this.captured[side].push(result.captured);
    }
    return result;
  }

  undo() {
    if (this.moveHistory.length === 0) return false;
    const last = this.game.history({ verbose: true }).pop();
    this.game.undo();
    this.moveHistory.pop();
    if (last?.captured) {
      const side = last.color === 'w' ? 'b' : 'w';
      this.captured[side].pop();
    }
    return true;
  }

  legalMoves(square) {
    return this.game.moves({ square, verbose: true }).map(m => m.to);
  }

  getStatus() {
    if (this.game.isCheckmate()) return 'checkmate';
    if (this.game.isStalemate()) return 'stalemate';
    if (this.game.isDraw()) return 'draw';
    if (this.game.isCheck()) return 'check';
    return 'playing';
  }

  fen() { return this.game.fen(); }
  turn() { return this.game.turn(); }
  isWhiteTurn() { return this.game.turn() === 'w'; }
}

// ============================================================
// ASSET MANAGER
// ============================================================
export class AssetManager {
  constructor() {
    this.cache = new Map();
    this.loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.loader.setDRACOLoader(draco);
  }

  async loadGLB(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    try {
      const gltf = await new Promise((resolve, reject) => {
        this.loader.load(path, resolve, undefined, reject);
      });
      this.cache.set(path, gltf);
      return gltf;
    } catch (e) {
      console.warn(`[AssetManager] Failed to load ${path}:`, e);
      return null;
    }
  }

  async loadTexture(path) {
    if (this.cache.has(path)) return this.cache.get(path);
    try {
      const tex = await new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(path, resolve, undefined, reject);
      });
      this.cache.set(path, tex);
      return tex;
    } catch (e) {
      return null;
    }
  }
}

// ============================================================
// ENVIRONMENT (Medieval Chamber)
// ============================================================
export class Environment {
  constructor(scene, assetMgr) {
    this.scene = scene;
    this.assetMgr = assetMgr;
    this.group = new THREE.Group();
    this.torchLights = [];
    this.flameMeshes = [];
    this.dustSystem = null;
  }

  build() {
    // --- Floor ---
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2a1f15, roughness: 0.95, metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // --- Board platform (raised stone dais) ---
    const daisGeo = new THREE.BoxGeometry(10, 0.6, 10);
    const daisMat = new THREE.MeshStandardMaterial({
      color: 0x3a3028, roughness: 0.85, metalness: 0.1,
    });
    const dais = new THREE.Mesh(daisGeo, daisMat);
    dais.position.y = 0.3;
    dais.castShadow = true;
    dais.receiveShadow = true;
    this.group.add(dais);

    // --- Walls (4 sides) ---
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x352d26, roughness: 0.95, metalness: 0.02,
    });
    const wallH = 8, wallT = 0.6, wallL = 26;
    const wallPositions = [
      { pos: [0, wallH / 2, -wallL / 2], rot: [0, 0, 0],       scale: [wallL, wallH, wallT] },
      { pos: [0, wallH / 2, wallL / 2],  rot: [0, 0, 0],       scale: [wallL, wallH, wallT] },
      { pos: [-wallL / 2, wallH / 2, 0], rot: [0, Math.PI / 2, 0], scale: [wallL, wallH, wallT] },
      { pos: [wallL / 2, wallH / 2, 0],  rot: [0, Math.PI / 2, 0], scale: [wallL, wallH, wallT] },
    ];
    for (const w of wallPositions) {
      const geo = new THREE.BoxGeometry(...w.scale);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(...w.pos);
      mesh.rotation.set(...w.rot);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }

    // --- Ceiling ---
    const ceilGeo = new THREE.PlaneGeometry(30, 30);
    const ceilMat = new THREE.MeshBasicMaterial({ color: 0x080604, side: THREE.DoubleSide });
    const ceil = new THREE.Mesh(ceilGeo, ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = wallH;
    this.group.add(ceil);

    // --- Torch lights + flame meshes ---
    const torchLocs = [
      [-5, 4.5, -5], [5, 4.5, -5], [-5, 4.5, 5], [5, 4.5, 5],
      [-8, 4, 0], [8, 4, 0],
    ];
    for (let i = 0; i < torchLocs.length; i++) {
      const pos = torchLocs[i];
      const light = new THREE.PointLight(
        i % 2 === 0 ? CFG.LIGHTING.torch1 : CFG.LIGHTING.torch2,
        18, 12, 1.5
      );
      light.position.set(...pos);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      this.group.add(light);
      this.torchLights.push(light);

      // Flame visual
      const flameGeo = new THREE.ConeGeometry(0.12, 0.35, 6);
      const flameMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xffaa44 : 0xff8833,
        transparent: true, opacity: 0.9,
      });
      const flame = new THREE.Mesh(flameGeo, flameMat);
      flame.position.set(pos[0], pos[1] + 0.3, pos[2]);
      this.group.add(flame);
      this.flameMeshes.push(flame);

      // Torch holder (small box on wall)
      const holderGeo = new THREE.BoxGeometry(0.3, 0.15, 0.15);
      const holderMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.8 });
      const holder = new THREE.Mesh(holderGeo, holderMat);
      holder.position.set(pos[0], pos[1] - 0.15, pos[2] + (pos[2] > 0 ? -0.2 : 0.2));
      this.group.add(holder);
    }

    // --- Dust particles ---
    this.dustSystem = this._createDust();
    this.group.add(this.dustSystem);

    // --- Ambient light ---
    const amb = new THREE.AmbientLight(CFG.LIGHTING.ambient, CFG.LIGHTING.ambientI);
    this.group.add(amb);

    // Subtle board glow from below
    const boardGlow = new THREE.PointLight(CFG.LIGHTING.boardGlow, 5, 8);
    boardGlow.position.set(0, CFG.BOARD_OFFSET_Y - 0.3, 0);
    this.group.add(boardGlow);

    this.scene.add(this.group);
  }

  _createDust() {
    const n = CFG.PARTICLES.DUST_COUNT;
    const pos = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = Math.random() * 6 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18;
      sizes[i] = Math.random() * 1.5 + 0.5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.PointsMaterial({
      color: 0xc9a84c, size: 0.04, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(geo, mat);
  }

  update(dt, time) {
    // Flicker torches
    for (let i = 0; i < this.torchLights.length; i++) {
      const l = this.torchLights[i];
      l.intensity = 16 + Math.sin(time * 6 + i * 1.7) * 4 + Math.sin(time * 11 + i * 3.1) * 2;
    }
    // Animate flames
    for (let i = 0; i < this.flameMeshes.length; i++) {
      const f = this.flameMeshes[i];
      f.scale.y = 1 + Math.sin(time * 12 + i * 2) * 0.25;
      f.scale.x = 1 + Math.sin(time * 9 + i * 3) * 0.1;
    }
    // Rotate dust slowly
    if (this.dustSystem) {
      this.dustSystem.rotation.y += dt * 0.015;
      const pos = this.dustSystem.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += Math.sin(time + i) * 0.001;
        if (y > 7) y = 0.5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }
}

// ============================================================
// CHESS BOARD
// ============================================================
export class ChessBoard {
  constructor(scene) {
    this.scene = scene;
    this.squares = [];    // [row][col] -> Mesh
    this.highlightMeshes = [];
    this.group = new THREE.Group();
  }

  build() {
    const s = CFG.SQUARE_SIZE;
    const offset = (s * CFG.BOARD_SIZE) / 2;

    for (let row = 0; row < 8; row++) {
      this.squares[row] = [];
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        const geo = new THREE.BoxGeometry(s, 0.08, s);
        const mat = new THREE.MeshStandardMaterial({
          color: isLight ? CFG.COLORS.boardLight : CFG.COLORS.boardDark,
          roughness: 0.65, metalness: 0.15,
        });
        const sq = new THREE.Mesh(geo, mat);
        const x = col * s - offset + s / 2;
        const z = row * s - offset + s / 2;
        sq.position.set(x, CFG.BOARD_OFFSET_Y, z);
        sq.receiveShadow = true;
        sq.userData = { type: 'square', row, col, id: `${String.fromCharCode(97 + col)}${8 - row}` };
        this.group.add(sq);
        this.squares[row][col] = sq;
      }
    }

    // Wooden frame
    this._buildFrame(offset);
    this.scene.add(this.group);
  }

  _buildFrame(offset) {
    const frameMat = new THREE.MeshStandardMaterial({
      color: CFG.COLORS.frame, roughness: 0.55, metalness: 0.25,
    });
    const boardW = CFG.BOARD_SIZE * CFG.SQUARE_SIZE;
    const fw = 0.35, fh = 0.18;

    const sides = [
      { s: [fw, fh, boardW + fw * 2], p: [-offset - fw / 2, CFG.BOARD_OFFSET_Y - fh / 2, 0] },
      { s: [fw, fh, boardW + fw * 2], p: [ offset + fw / 2, CFG.BOARD_OFFSET_Y - fh / 2, 0] },
      { s: [boardW + fw * 2, fh, fw], p: [0, CFG.BOARD_OFFSET_Y - fh / 2, -offset - fw / 2] },
      { s: [boardW + fw * 2, fh, fw], p: [0, CFG.BOARD_OFFSET_Y - fh / 2,  offset + fw / 2] },
    ];
    for (const side of sides) {
      const g = new THREE.BoxGeometry(...side.s);
      const m = new THREE.Mesh(g, frameMat);
      m.position.set(...side.p);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }

    // Corner runes (small glowing spheres)
    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xc9a84c, emissive: 0xc9a84c, emissiveIntensity: 0.3,
      roughness: 0.3, metalness: 0.7,
    });
    const runePos = [
      [-offset - fw,  CFG.BOARD_OFFSET_Y + 0.1, -offset - fw],
      [ offset + fw,  CFG.BOARD_OFFSET_Y + 0.1, -offset - fw],
      [-offset - fw,  CFG.BOARD_OFFSET_Y + 0.1,  offset + fw],
      [ offset + fw,  CFG.BOARD_OFFSET_Y + 0.1,  offset + fw],
    ];
    for (const p of runePos) {
      const g = new THREE.SphereGeometry(0.1, 8, 8);
      const m = new THREE.Mesh(g, runeMat);
      m.position.set(...p);
      this.group.add(m);
    }
  }

  squarePos(id) {
    const col = id.charCodeAt(0) - 97;
    const row = 8 - parseInt(id[1]);
    const s = CFG.SQUARE_SIZE;
    const offset = (s * CFG.BOARD_SIZE) / 2;
    return new THREE.Vector3(
      col * s - offset + s / 2,
      CFG.BOARD_OFFSET_Y + 0.04,
      row * s - offset + s / 2
    );
  }

  squareFromId(id) {
    return this.squares[8 - parseInt(id[1])]?.[id.charCodeAt(0) - 97];
  }

  highlightSquare(id, color, duration = 0.8) {
    const sq = this.squareFromId(id);
    if (!sq) return;
    sq.material.emissive.setHex(color);
    sq.material.emissiveIntensity = 0.6;
    setTimeout(() => {
      sq.material.emissive.setHex(0x000000);
      sq.material.emissiveIntensity = 0;
    }, duration * 1000);
  }

  clearHighlights() {
    for (const row of this.squares)
      for (const sq of row) {
        sq.material.emissive.setHex(0x000000);
        sq.material.emissiveIntensity = 0;
      }
  }
}

// ============================================================
// PIECE MESH
// ============================================================
export class PieceMesh extends THREE.Group {
  constructor(pieceType, color, board, assetMgr) {
    super();
    this.pieceType = pieceType; // 'k','q','r','b','n','p'
    this.color = color;       // 'w' or 'b'
    this.board = board;
    this.assetMgr = assetMgr;
    this.currentSquare = null;
    this.isAnimating = false;
    this.meshes = [];

    this._build(color === 'w' ? CFG.COLORS.whitePiece : CFG.COLORS.blackPiece);
  }

  _build(baseColor) {
    const isWhite = this.color === 'w';
    const mat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: isWhite ? 0.25 : 0.8,
      metalness: isWhite ? 0.5 : 0.1,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });

    switch (this.pieceType.toLowerCase()) {
      case 'p': { // Pawn — sphere base + dome top
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16), mat.clone());
        base.position.y = 0.06;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat.clone());
        body.position.y = 0.26;
        body.scale.y = 1.3;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), mat.clone());
        head.position.y = 0.44;
        this.add(base, body, head);
        this.meshes.push(base, body, head);
        break;
      }
      case 'r': { // Rook — cylindrical tower
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 16), mat.clone());
        base.position.y = 0.07;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 12), mat.clone());
        body.position.y = 0.35;
        const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 8), mat.clone());
        top.position.y = 0.61;
        // Battlements
        for (let i = 0; i < 4; i++) {
          const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), mat.clone());
          const a = (i / 4) * Math.PI * 2;
          b.position.set(Math.cos(a) * 0.16, 0.7, Math.sin(a) * 0.16);
          this.add(b);
          this.meshes.push(b);
        }
        this.add(base, body, top);
        this.meshes.push(base, body, top);
        break;
      }
      case 'n': { // Knight — horse head approximation
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.14, 16), mat.clone());
        base.position.y = 0.07;
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 12), mat.clone());
        body.position.y = 0.38;
        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.28), mat.clone());
        head.position.set(0, 0.62, 0.06);
        head.rotation.x = -0.15;
        // Snout
        const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.14), mat.clone());
        snout.position.set(0, 0.52, 0.18);
        // Ear
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), mat.clone());
        ear.position.set(0, 0.78, 0);
        this.add(base, body, head, snout, ear);
        this.meshes.push(base, body, head, snout, ear);
        break;
      }
      case 'b': { // Bishop — tall with pointed top
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.12, 16), mat.clone());
        base.position.y = 0.06;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 12), mat.clone());
        body.position.y = 0.41;
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), mat.clone());
        head.position.y = 0.72;
        head.scale.y = 1.4;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat.clone());
        knob.position.y = 0.86;
        this.add(base, body, head, knob);
        this.meshes.push(base, body, head, knob);
        break;
      }
      case 'q': { // Queen — elegant crown
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.14, 16), mat.clone());
        base.position.y = 0.07;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.55, 12), mat.clone());
        body.position.y = 0.44;
        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), mat.clone());
        shoulders.position.y = 0.74;
        shoulders.scale.y = 0.6;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.12, 8), mat.clone());
        crown.position.y = 0.88;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat.clone());
        tip.position.y = 1.0;
        // Small points around crown
        for (let i = 0; i < 5; i++) {
          const pt = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), mat.clone());
          const a = (i / 5) * Math.PI * 2;
          pt.position.set(Math.cos(a) * 0.14, 0.97, Math.sin(a) * 0.14);
          this.add(pt);
          this.meshes.push(pt);
        }
        this.add(base, body, shoulders, crown, tip);
        this.meshes.push(base, body, shoulders, crown, tip);
        break;
      }
      case 'k': { // King — tallest with cross
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.16, 16), mat.clone());
        base.position.y = 0.08;
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.58, 12), mat.clone());
        body.position.y = 0.45;
        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), mat.clone());
        shoulders.position.y = 0.78;
        shoulders.scale.y = 0.55;
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.14, 8), mat.clone());
        crown.position.y = 0.95;
        // Cross
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), mat.clone());
        crossV.position.y = 1.12;
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), mat.clone());
        crossH.position.y = 1.16;
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), mat.clone());
        tip.position.y = 1.26;
        this.add(base, body, shoulders, crown, crossV, crossH, tip);
        this.meshes.push(base, body, shoulders, crown, crossV, crossH, tip);
        break;
      }
    }

    this.traverse(c => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
  }

  setScale(s) {
    this.scale.setScalar(s);
  }

  highlight(active) {
    const intensity = active ? 0.35 : 0;
    this.traverse(c => {
      if (c.isMesh && c.material) {
        c.material.emissive.setHex(active ? CFG.COLORS.selected : 0x000000);
        c.material.emissiveIntensity = intensity;
      }
    });
  }
}

// ============================================================
// PIECE CONTROLLER
// ============================================================
export class PieceController {
  constructor(scene, board, assetMgr) {
    this.scene = scene;
    this.board = board;
    this.assetMgr = assetMgr;
    this.pieces = new Map();   // squareId -> PieceMesh
    this.selected = null;
    this.animQueue = [];
  }

  placePieces(fen) {
    // Clear existing
    for (const [, m] of this.pieces) this.scene.remove(m);
    this.pieces.clear();
    this.selected = null;

    const [pieces] = fen.split(' ');
    let row = 7, col = 0;
    for (const ch of pieces) {
      if (ch === '/') { row--; col = 0; }
      else if (/\d/.test(ch)) col += parseInt(ch);
      else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toLowerCase();
        const id = `${String.fromCharCode(97 + col)}${8 - row}`;
        const mesh = new PieceMesh(type, color, this.board, this.assetMgr);
        const pos = this.board.squarePos(id);
        mesh.position.copy(pos);
        mesh.position.y += 0.5;
        mesh.userData = { squareId: id, piece: { type, color } };
        this.scene.add(mesh);
        this.pieces.set(id, mesh);
        col++;
      }
    }
  }

  select(squareId) {
    if (this.selected) this.pieces.get(this.selected)?.highlight(false);
    this.selected = squareId;
    this.pieces.get(squareId)?.highlight(true);
  }

  deselect() {
    if (this.selected) {
      this.pieces.get(this.selected)?.highlight(false);
      this.selected = null;
    }
  }

  async movePiece(from, to) {
    const mesh = this.pieces.get(from);
    if (!mesh) return false;

    const dest = this.board.squarePos(to);
    dest.y += 0.5;

    // Animate
    const dur = CFG.ANIM.MOVE_DUR;
    const start = performance.now();
    const startPos = mesh.position.clone();
    const arcHeight = 0.6;

    return new Promise(resolve => {
      const tick = () => {
        const elapsed = (performance.now() - start) / 1000;
        const t = Math.min(elapsed / dur, 1);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        mesh.position.lerpVectors(startPos, dest, ease);
        mesh.position.y += Math.sin(t * Math.PI) * arcHeight;

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          mesh.position.copy(dest);
          mesh.userData.squareId = to;
          this.pieces.delete(from);
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
    // Fade + shrink
    const start = performance.now();
    const dur = CFG.ANIM.CAPTURE_DUR * 1000;
    const origScale = mesh.scale.x;
    const tick = () => {
      const t = Math.min((performance.now() - start) / dur, 1);
      mesh.scale.setScalar(origScale * (1 - t));
      mesh.children.forEach(c => {
        if (c.isMesh && c.material) c.material.opacity = 1 - t;
      });
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.scene.remove(mesh);
        this.pieces.delete(squareId);
      }
    };
    tick();
  }

  update(dt) { /* future: idle animations */ }
}

// ============================================================
// CAMERA CONTROLLER
// ============================================================
export class CameraController {
  constructor(camera, controls, renderer) {
    this.camera = camera;
    this.controls = controls;
    this.renderer = renderer;
    this.state = 'intro'; // 'intro' | 'orbit' | 'focus'
    this.introT = 0;
    this.focusTarget = null;
    this.focusStart = null;
    this.focusEnd = null;
    this.focusT = 0;
  }

  startIntro() {
    this.state = 'intro';
    this.introT = 0;
    this.camera.position.copy(CFG.CAMERA.INTRO_START);
    this.camera.lookAt(0, CFG.BOARD_OFFSET_Y, 0);
    this.controls.enabled = false;
  }

  releaseToOrbit() {
    this.state = 'orbit';
    this.controls.enabled = true;
  }

  focusOn(squareId) {
    if (this.state !== 'orbit') return;
    const pos = this.board?.squarePos(squareId);
    if (!pos) return;
    this.state = 'focus';
    this.focusT = 0;
    this.focusStart = this.camera.position.clone();
    const offset = new THREE.Vector3(0, 2.5, 3.5);
    this.focusEnd = pos.clone().add(offset);
  }

  update(dt) {
    if (this.state === 'intro') {
      this.introT += dt;
      const t = Math.min(this.introT / CFG.CAMERA.INTRO_DUR, 1);
      const ease = t * t * (3 - 2 * t); // smoothstep
      const start = CFG.CAMERA.INTRO_START;
      const end = CFG.CAMERA.INTRO_END;
      this.camera.position.lerpVectors(start, end, ease);
      this.camera.lookAt(0, CFG.BOARD_OFFSET_Y, 0);
      if (t >= 1) this.releaseToOrbit();
    } else if (this.state === 'focus') {
      this.focusT += dt;
      const t = Math.min(this.focusT / 0.8, 1);
      const ease = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.focusStart, this.focusEnd, ease);
      const target = this.focusTarget || new THREE.Vector3(0, CFG.BOARD_OFFSET_Y, 0);
      this.camera.lookAt(target);
      if (t >= 1) this.state = 'orbit';
    }
    this.controls.update();
  }

  get board() {
    // lazy reference to avoid circular dependency at class definition time
    return (window._gameEngine?.board);
  }
}

// ============================================================
// VFX CONTROLLER
// ============================================================
export class VFXController {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spark(position, count = 20) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.03, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.08 + Math.random() * 0.06, 1, 0.6),
        transparent: true, opacity: 1,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(position);
      m.userData.v = new THREE.Vector3(
        (Math.random() - 0.5) * 0.15,
        Math.random() * 0.12,
        (Math.random() - 0.5) * 0.15
      );
      m.userData.life = 1;
      m.userData.decay = 0.015 + Math.random() * 0.02;
      this.scene.add(m);
      this.active.push(m);
    }
  }

  flash(position) {
    const light = new THREE.PointLight(0xffaa44, 40, 6);
    light.position.copy(position);
    light.position.y += 0.5;
    this.scene.add(light);
    this.active.push({ light, life: 1, decay: 0.08, isLight: true });
  }

  checkRing(position) {
    // Glowing ring around the king
    const ringGeo = new THREE.TorusGeometry(0.6, 0.04, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff4444, transparent: true, opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(position);
    ring.position.y += 0.5;
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.active.push({ mesh: ring, life: 1, decay: 0.025, isRing: true });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        if (p.isLight) this.scene.remove(p.light);
        else if (p.isRing) this.scene.remove(p.mesh);
        else this.scene.remove(p);
        this.active.splice(i, 1);
        continue;
      }
      if (p.isLight) {
        p.light.intensity = p.life * 40;
      } else if (p.isRing) {
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(1 + (1 - p.life) * 0.8);
      } else {
        p.material.opacity = p.life;
        p.position.add(p.userData.v);
        p.userData.v.y -= 0.004; // gravity
        p.userData.v.x *= 0.96;
        p.userData.v.z *= 0.96;
      }
    }
  }
}

// ============================================================
// AUDIO CONTROLLER
// ============================================================
export class AudioController {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) { console.warn('[Audio] Web Audio not available:', e); }
  }

  _tone(freq, dur, type = 'sine', vol = 0.2) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  playMove()  { this._tone(660, 0.08, 'sine', 0.15); }
  playCapture() {
    this._tone(220, 0.12, 'square', 0.2);
    setTimeout(() => this._tone(165, 0.1, 'square', 0.15), 60);
  }
  playCheck() {
    this._tone(880, 0.08, 'sawtooth', 0.2);
    setTimeout(() => this._tone(660, 0.12, 'sawtooth', 0.15), 80);
  }
  playCheckmate() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._tone(f, 0.35, 'sine', 0.25), i * 130)
    );
  }
  playSelect() { this._tone(880, 0.05, 'sine', 0.1); }
}

// ============================================================
// UI MANAGER
// ============================================================
export class UIManager {
  constructor() {
    this.els = {};
    this._cacheEls();
    this._bindButtons();
  }

  _cacheEls() {
    const ids = ['loader','loaderFill','loaderStatus','ui','turnIndicator',
      'checkBadge','checkmateBadge','capturedWhitePieces','capturedBlackPieces',
      'moveHistory'];
    for (const id of ids) this.els[id] = document.getElementById(id);
  }

  _bindButtons() {
    document.getElementById('btnNew').addEventListener('click', () => window._gameEngine?.newGame());
    document.getElementById('btnUndo').addEventListener('click', () => window._gameEngine?.undoMove());
    document.getElementById('btnView').addEventListener('click', () => window._gameEngine?.resetCamera());
  }

  showLoader()  { this.els.loader.classList.remove('hidden'); this.els.ui.classList.add('hidden'); }
  hideLoader()  { this.els.loader.classList.add('hidden');    this.els.ui.classList.remove('hidden'); }

  setProgress(pct) {
    if (this.els.loaderFill) this.els.loaderFill.style.width = `${pct}%`;
  }
  setStatus(text) {
    if (this.els.loaderStatus) this.els.loaderStatus.textContent = text;
  }

  setTurn(white) {
    this.els.turnIndicator.textContent = white ? "White's turn" : "Black's turn";
  }

  setStatusBadge(status, gameStatus) {
    if (status === 'check') {
      this.els.checkBadge.classList.remove('hidden');
      this.els.checkmateBadge.classList.add('hidden');
    } else if (gameStatus === 'checkmate') {
      this.els.checkBadge.classList.add('hidden');
      this.els.checkmateBadge.classList.remove('hidden');
      const winner = gameStatus === 'checkmate' ? (this._lastWhiteTurn ? 'Black' : 'White') : '?';
      this.els.checkmateBadge.textContent = `Checkmate! ${winner} wins.`;
    } else {
      this.els.checkBadge.classList.add('hidden');
      this.els.checkmateBadge.classList.add('hidden');
    }
  }

  setCaptured(captured) {
    const sym = { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' };
    const whiteEl = document.getElementById('capturedWhitePieces');
    const blackEl = document.getElementById('capturedBlackPieces');
    if (whiteEl) whiteEl.innerHTML = (captured.w || []).map(p => `<span>${sym[p] ?? ''}</span>`).join('');
    if (blackEl) blackEl.innerHTML = (captured.b || []).map(p => `<span>${sym[p] ?? ''}</span>`).join('');
  }

  setHistory(history) {
    if (!this.els.moveHistory) return;
    let html = '';
    for (let i = 0; i < history.length; i += 2)
      html += `${Math.floor(i / 2) + 1}. ${history[i]}${history[i + 1] ? ' ' + history[i + 1] : ''}&nbsp;&nbsp;`;
    this.els.moveHistory.textContent = html.trim();
  }

  highlightSquare(id, color) {
    window._gameEngine?.board?.highlightSquare(id, color);
  }
  clearHighlights() {
    window._gameEngine?.board?.clearHighlights();
  }
}

// ============================================================
// MAIN GAME ENGINE
// ============================================================
export class Game {
  constructor() {
    this.engine = new ThreeJSEngine();
    this.chess  = new ChessEngine();
    this.assets = new AssetManager();
    this.env    = new Environment(this.engine.scene, this.assets);
    this.board  = new ChessBoard(this.engine.scene);
    this.pieces = new PieceController(this.engine.scene, this.board, this.assets);
    this.cam    = new CameraController(this.engine.camera, this.engine.controls, this.engine.renderer);
    this.vfx    = new VFXController(this.engine.scene);
    this.audio  = new AudioController();
    this.ui     = new UIManager();

    // Link references for cross-module access
    window._gameEngine = this;
    this.running = false;
    this._lastWhiteTurn = true;
  }

  async init() {
    this.ui.showLoader();
    this.ui.setProgress(10);
    this.ui.setStatus('Preparing the chamber…');

    this.env.build();
    this.ui.setProgress(40);
    this.ui.setStatus('Carving the board…');

    this.board.build();
    this.ui.setProgress(60);
    this.ui.setStatus('Setting up the pieces…');

    this.pieces.placePieces(this.chess.fen());
    this.ui.setProgress(80);
    this.ui.setStatus('Lighting the torches…');

    // Try to load real chess GLB if available, otherwise keep procedural pieces
    try {
      const glb = await this.assets.loadGLB('assets/chess_set.glb');
      if (glb) {
        console.log('[Game] Loaded real chess set GLB — replacing procedural pieces');
        this.useRealPieces = true;
        this._replaceWithGLBPieces(glb);
      }
    } catch (e) {
      console.log('[Game] Using procedural pieces (chess_set.glb not found yet)');
    }

    this.ui.setProgress(100);
    this.ui.setStatus('Ready.');

    await new Promise(r => setTimeout(r, 600));
    this.ui.hideLoader();

    this.cam.startIntro();
    this.running = true;
    this._setupInput();
    this._loop();
  }

  async _replaceWithGLBPieces(gltf) {
    // Replace procedural pieces with GLB-loaded models
    const oldPieces = Array.from(this.pieces.pieces.values());
    oldPieces.forEach(m => this.engine.scene.remove(m));
    this.pieces.pieces.clear();

    // Map GLB scene objects to chess pieces by name
    const pieceNames = {
      white_pawn: 'p', white_queen: 'q', white_rook: 'r', white_bishop: 'b', white_knight: 'n', white_king: 'k',
      black_pawn: 'P', black_queen: 'Q', black_rook: 'R', black_bishop: 'B', black_knight: 'N', black_king: 'K',
    };

    for (const obj of gltf.scene.children) {
      const name = obj.name?.toLowerCase() || '';
      const mapped = pieceNames[name];
      if (!mapped) continue;

      const color = name.startsWith('black') ? 'b' : 'w';
      const id = obj.userData?.squareId;
      if (!id) continue;

      obj.position.set(0, 0, 0);
      obj.userData.squareId = id;
      obj.userData.piece = { type: mapped, color };
      this.pieces.pieces.set(id, obj);
      this.engine.scene.add(obj);
    }
  }

  _setupInput() {
    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('click', e => this._onClick(e));
    // Also init audio on first interaction
    const initAudio = () => { this.audio.init(); canvas.removeEventListener('click', initAudio); };
    canvas.addEventListener('click', initAudio, { once: true });
  }

  _onClick(e) {
    if (!this.running) return;
    this.audio.init();

    const rect = this.engine.renderer.domElement.getBoundingClientRect();
    this.engine.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.engine.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.engine.raycaster.setFromCamera(this.engine.mouse, this.engine.camera);

    // Collect all clickable objects: board squares + piece meshes
    const targets = [
      ...this.board.group.children,
      ...Array.from(this.pieces.pieces.values()).flat(),
    ].filter(c => c.isMesh);

    const hits = this.engine.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return;

    // Walk up to find the piece group or square
    let hitObj = hits[0].object;
    while (hitObj.parent && hitObj.parent !== this.engine.scene && !hitObj.userData.squareId && !hitObj.userData.type)
      hitObj = hitObj.parent;

    const data = hitObj.userData;
    if (data.type === 'square') {
      const sqId = data.id;
      if (this.pieces.selected) {
        const legal = this.chess.legalMoves(this.pieces.selected);
        if (legal.includes(sqId)) this._execMove(this.pieces.selected, sqId);
        else { this.pieces.deselect(); this.board.clearHighlights(); }
      } else {
        // Check if there's a piece on this square
        const pieceAt = this.pieces.pieces.get(sqId);
        if (pieceAt) this.pieces.select(sqId);
      }
    } else if (data.squareId) {
      this.pieces.select(data.squareId);
      this.audio.playSelect();
    }
  }

  async _execMove(from, to) {
    // Get legal move info for capture detection
    const legal = this.chess.legalMoves(from);
    const verboseMove = legal.find(m => m.to === to);

    const result = this.chess.move(from, to);
    if (!result) return;

    this.audio.playSelect();

    // Animate
    await this.pieces.movePiece(from, to);

    // Capture?
    if (verboseMove?.captured) {
      this.pieces.captureAt(to);
      this.audio.playCapture();
      const pos = this.board.squarePos(to);
      this.vfx.spark(pos);
      this.vfx.flash(pos);
    } else {
      this.audio.playMove();
    }

    this.pieces.deselect();
    this.board.clearHighlights();

    this.ui.setTurn(this.chess.isWhiteTurn());
    this.ui.setCaptured(this.chess.captured);
    this.ui.setHistory(this.chess.moveHistory);

    const status = this.chess.getStatus();
    this._lastWhiteTurn = this.chess.isWhiteTurn();
    this.ui.setStatusBadge(status, status);

    if (status === 'check') {
      this.audio.playCheck();
      // Highlight opposing king
      const kingSq = this._findKing(this.chess.game.turn());
      if (kingSq) {
        this.vfx.checkRing(this.board.squarePos(kingSq));
        this.board.highlightSquare(kingSq, 0xff4444, 2.0);
      }
    } else if (status === 'checkmate') {
      this.audio.playCheckmate();
    }
  }

  _findKing(color) {
    for (const [id, mesh] of this.pieces.pieces) {
      const p = mesh.userData.piece;
      if (p && p.color === color && p.type === 'k') return id;
    }
    return null;
  }

  newGame() {
    this.chess.reset();
    this.pieces.placePieces(this.chess.fen());
    this.pieces.deselect();
    this.board.clearHighlights();
    this.ui.setTurn(true);
    this.ui.setStatusBadge(null, null);
    this.ui.setCaptured({ w: [], b: [] });
    this.ui.setHistory([]);
    this.audio.init();
  }

  undoMove() {
    if (!this.chess.undo()) return;
    this.pieces.placePieces(this.chess.fen());
    this.pieces.deselect();
    this.board.clearHighlights();
    this.ui.setTurn(this.chess.isWhiteTurn());
    this.ui.setStatusBadge(null, null);
    this.ui.setCaptured(this.chess.captured);
    this.ui.setHistory(this.chess.moveHistory);
  }

  resetCamera() {
    this.cam.startIntro();
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());

    const dt = Math.min(this.engine.clock.getDelta(), 0.1);
    const time = this.engine.clock.getElapsedTime();

    this.cam.update(dt);
    this.pieces.update(dt);
    this.env.update(dt, time);
    this.vfx.update(dt);

    this.engine.render();
  }
}
