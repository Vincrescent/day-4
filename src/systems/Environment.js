/**
 * Environment — medieval stone chamber.
 *
 * Loads the Kenney Modular Dungeon Kit room (CC0, 12×12×4.23m) and scales it
 * ×2 so the chessboard (8u) sits on a dais in the middle with headroom for
 * the camera and lighting. Fog, torches, dust, and a single shadow-casting
 * spotlight complete the atmosphere.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

const ROOM_SCALE = 2.0; // 12→24 m wide, 4.23→8.46 m tall

export class Environment {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.group = new THREE.Group();
    this.torches = [];
    this.dust = null;
    this.room = null;
    this.spot = null;
  }

  async build() {
    // Fog — thick enough to soften the far corners, thin enough to read the board.
    this.scene.fog = new THREE.FogExp2(0x070503, 0.045);

    // --- Room (Kenney, CC0) scaled ×2 ---
    try {
      const gltf = await this.assets.loadGLB('assets/env/room-small.glb');
      this.room = new THREE.Group();
      this.room.scale.setScalar(ROOM_SCALE);
      gltf.scene.traverse(o => {
        if (o.isMesh) {
          o.castShadow = false;   // room never casts (it's the container)
          o.receiveShadow = true;
          this.room.add(o);
        }
      });
      this.group.add(this.room);
    } catch (e) {
      console.warn('[Environment] Kenney room failed, using fallback walls:', e);
      this._fallbackWalls();
    }

    // --- Dais under the board ---
    this._buildDais();

    // --- Lighting ---
    this._buildLights();

    // --- Dust motes ---
    this.dust = this._buildDust(110);
    this.group.add(this.dust);

    // --- Gothic Rain System ---
    this.rain = this._buildRain(900);
    this.group.add(this.rain);

    // --- Gothic Lightning Flash light ---
    this.lightningLight = new THREE.DirectionalLight(0x88bbff, 0);
    this.lightningLight.position.set(2, 12, -4);
    this.group.add(this.lightningLight);
    this.nextLightningTime = 6 + Math.random() * 8;
    this.lightningFlashTimer = 0;

    this.scene.add(this.group);
  }

  _buildRain(count) {
    const pos = new Float32Array(count * 3);
    const vels = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = 0.5 + Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
      vels[i] = 7 + Math.random() * 5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rainVels = vels;
    
    // Create soft rain line texture
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(180, 210, 255, 0)');
    grad.addColorStop(0.5, 'rgba(180, 210, 255, 0.6)');
    grad.addColorStop(1, 'rgba(220, 240, 255, 0.9)');
    ctx.fillStyle = grad;
    ctx.fillRect(6, 0, 4, 64);
    const tex = new THREE.CanvasTexture(cv);

    const m = new THREE.PointsMaterial({
      map: tex,
      color: 0x99bbdd,
      size: 0.18,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(g, m);
  }

  _fallbackWalls() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c251d, roughness: 0.95, metalness: 0.03 });
    const H = 8, L = 22;
    const walls = [
      { p: [0, H / 2, -L / 2], s: [L + 2, H, 0.6] },
      { p: [0, H / 2, L / 2],  s: [L + 2, H, 0.6] },
      { p: [-L / 2, H / 2, 0], s: [0.6, H, L + 2] },
      { p: [L / 2, H / 2, 0],  s: [0.6, H, L + 2] },
    ];
    for (const w of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(...w.s), mat);
      m.position.set(...w.p);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  _buildDais() {
    // Two-tier stone dais. Top surface at CFG.BOARD_OFFSET_Y ≈ 0.82.
    const stone = new THREE.MeshStandardMaterial({
      color: CFG.COLORS.daisStone, roughness: 0.92, metalness: 0.04,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.55, 11.2), stone);
    base.position.y = 0.275;
    base.receiveShadow = true;
    base.castShadow = false;
    const step = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.27, 10.4), stone.clone());
    step.position.y = 0.685;
    step.receiveShadow = true;
    step.castShadow = false;
    this.group.add(base, step);
  }

  _buildLights() {
    // Key: warm spot from above-front — the ONLY shadow caster (1024 map).
    const spot = new THREE.SpotLight(0xffd9a8, 28, 26, Math.PI / 5, 0.55, 1.6);
    spot.position.set(0, 7.4, 5.0);
    spot.target.position.set(0, CFG.BOARD_OFFSET_Y, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 2;
    spot.shadow.camera.far = 20;
    spot.shadow.bias = -0.0005;
    spot.shadow.radius = 4;
    this.group.add(spot, spot.target);
    this.spot = spot;

    // Fill: faint cool from opposite corner (very dim for dark gothic mood).
    const fill = new THREE.PointLight(0x334488, 4, 26, 1.6);
    fill.position.set(-5.5, 4.0, -5.5);
    this.group.add(fill);

    // Back-fill: warm light on the black side so pieces are visible.
    const backFill = new THREE.SpotLight(0xeec88a, 12, 22, Math.PI / 4, 0.6, 1.8);
    backFill.position.set(0, 6.0, -6.5);
    backFill.target.position.set(0, CFG.BOARD_OFFSET_Y, -1.5);
    backFill.castShadow = false;
    this.group.add(backFill, backFill.target);

    // Hemispheric ambient — slightly brighter for readability.
    const hemi = new THREE.HemisphereLight(0x1a1510, 0x040302, 0.50);
    this.group.add(hemi);

    // Torches — warm flickering sconces on the walls (no shadow casting: 4 extra
    // shadow maps would blow the frame budget).
    const torchPos = [
      [-5.6, 4.2, -5.6],
      [5.6, 4.2, -5.6],
      [-5.6, 4.2, 5.6],
      [5.6, 4.2, 5.6],
    ];
    torchPos.forEach((p, i) => {
      const light = new THREE.PointLight(i % 2 ? 0xff6622 : 0xff8833, 6, 14, 1.7);
      light.position.set(...p);
      this.group.add(light);
      this.torches.push({ light, phase: i * 1.9 });

      // Flame glow sprite (procedural — additive circle, no texture needed).
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this._flameTexture(),
        color: 0xffb055, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sprite.position.set(...p);
      sprite.scale.setScalar(0.8);
      this.group.add(sprite);
      this.torches[i].sprite = sprite;
    });
  }

  _flameTexture() {
    // Small radial-gradient canvas used as the flame glow.
    const size = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, 'rgba(255, 200, 120, 1)');
    grad.addColorStop(0.35, 'rgba(255, 150, 60, 0.55)');
    grad.addColorStop(1, 'rgba(255, 100, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildDust(count) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = 0.3 + Math.random() * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 18;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x887744, size: 0.035, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(g, m);
  }

  update(dt, time) {
    // Torch flicker
    for (const t of this.torches) {
      const f = Math.sin(time * 7 + t.phase) * 0.5 + Math.sin(time * 13 + t.phase * 2) * 0.3 + Math.sin(time * 3 + t.phase) * 0.2;
      t.light.intensity = 16 + f * 6;
      const s = 0.8 + f * 0.1;
      t.sprite.scale.setScalar(s);
    }
    // Spot subtle breathing
    if (this.spot) this.spot.intensity = 28 + Math.sin(time * 1.3) * 4;
    // Dust drift
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.05;
        if (y > 7.5) y = 0.3;
        p.setY(i, y);
      }
      p.needsUpdate = true;
      this.dust.material.opacity = 0.18 + Math.sin(time * 0.4) * 0.06;
    }

    // Gothic Rain Animation
    if (this.rain) {
      const p = this.rain.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - this.rainVels[i] * dt;
        if (y < 0.2) {
          y = 8.5 + Math.random() * 2;
        }
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }

    // Gothic Lightning Flashes
    if (this.lightningLight) {
      if (this.lightningFlashTimer > 0) {
        this.lightningFlashTimer -= dt;
        // Jitter lightning intensity
        this.lightningLight.intensity = (Math.random() > 0.3 ? 18 : 3) * (this.lightningFlashTimer / 0.25);
      } else {
        this.lightningLight.intensity = 0;
        if (time > this.nextLightningTime) {
          this.lightningFlashTimer = 0.22;
          this.nextLightningTime = time + 7 + Math.random() * 12;
        }
      }
    }
  }
}