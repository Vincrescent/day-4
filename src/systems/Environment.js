/**
 * Environment — medieval stone chamber.
 * Loads Kenney Modular Dungeon Kit room (CC0), adds a dais, torches,
 * spotlight focal, dust, and fog. The chess board remains the focal point.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

export class Environment {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.group = new THREE.Group();
    this.torches = [];
    this.dust = null;
    this.room = null;
  }

  async build() {
    // Fog
    this.scene.fog = new THREE.FogExp2(0x070503, 0.055);

    // --- Room (Kenney, CC0) ---
    try {
      const gltf = await this.assets.loadGLB('assets/env/room-small.glb');
      this.room = new THREE.Group();
      gltf.scene.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true;
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
    this.dust = this._buildDust(90);
    this.group.add(this.dust);

    this.scene.add(this.group);
  }

  _fallbackWalls() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c251d, roughness: 0.95, metalness: 0.03 });
    const H = 5, L = 14;
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
      m.castShadow = true;
      this.group.add(m);
    }
  }

  _buildDais() {
    const stone = new THREE.MeshStandardMaterial({
      color: 0x3a3128, roughness: 0.9, metalness: 0.05,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(10.6, 0.18, 10.6), stone.clone());
    base.position.y = 0.09;
    base.receiveShadow = true;
    base.castShadow = true;
    const step = new THREE.Mesh(new THREE.BoxGeometry(9.9, 0.37, 9.9), stone.clone());
    step.position.y = 0.355;
    step.receiveShadow = true;
    step.castShadow = true;
    this.group.add(base, step);
  }

  _buildLights() {
    // Key: warm spot from above-front, the single shadow caster on the board.
    const spot = new THREE.SpotLight(0xffd9a8, 260, 30, Math.PI / 5, 0.55, 1.4);
    spot.position.set(0, 6.4, 4.5);
    spot.target.position.set(0, 0.7, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.camera.near = 1;
    spot.shadow.camera.far = 20;
    spot.shadow.bias = -0.0004;
    this.group.add(spot, spot.target);
    this.spot = spot;

    // Fill: faint cool from the opposite corner to read piece silhouettes.
    const fill = new THREE.PointLight(0x5566aa, 12, 24, 1.6);
    fill.position.set(-4.5, 3.2, -4.5);
    this.group.add(fill);

    // Hemispheric ambient.
    const hemi = new THREE.HemisphereLight(0x2a2218, 0x0a0705, 0.55);
    this.group.add(hemi);

    // Torches — warm flickering corners.
    const torchPos = [
      [-4.4, 3.4, -4.4],
      [4.4, 3.4, -4.4],
      [-4.4, 3.4, 4.4],
      [4.4, 3.4, 4.4],
    ];
    torchPos.forEach((p, i) => {
      const light = new THREE.PointLight(i % 2 ? 0xff8833 : 0xffaa55, 14, 14, 1.7);
      light.position.set(...p);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.bias = -0.002;
      this.group.add(light);
      this.torches.push({ light, phase: i * 1.9 });

      // Flame glow sprite
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        color: 0xffb055, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sprite.position.set(...p);
      sprite.scale.setScalar(0.55);
      this.group.add(sprite);
      this.torches[i].sprite = sprite;
    });
  }

  _buildDust(count) {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 11;
      pos[i * 3 + 1] = 0.3 + Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 11;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0xc9a84c, size: 0.035, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    return new THREE.Points(g, m);
  }

  update(dt, time) {
    // Torch flicker
    for (const t of this.torches) {
      const f = Math.sin(time * 7 + t.phase) * 0.5 + Math.sin(time * 13 + t.phase * 2) * 0.3 + Math.sin(time * 3 + t.phase) * 0.2;
      t.light.intensity = 14 + f * 5;
      const s = 0.55 + f * 0.07;
      t.sprite.scale.setScalar(s);
    }
    // Spot subtle breathing
    if (this.spot) this.spot.intensity = 260 + Math.sin(time * 1.3) * 8;
    // Dust drift
    if (this.dust) {
      const p = this.dust.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + dt * 0.04;
        if (y > 4.4) y = 0.3;
        p.setY(i, y);
      }
      p.needsUpdate = true;
      this.dust.material.opacity = 0.28 + Math.sin(time * 0.4) * 0.08;
    }
  }
}
