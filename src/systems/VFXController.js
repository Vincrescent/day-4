/**
 * VFXController — particle events: capture sparks, flashes, check ring,
 * ambient select puffs. Uses Kenney sprite textures (CC0) where fitting,
 * otherwise lightweight procedural meshes.
 */
import * as THREE from 'three';

export class VFXController {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.sparkTex = null;
    this.magicTex = null;
    this.puffTex = null;
    this.sparkPool = [];
    this.active = [];   // {obj, life, decay, vel?, isLight?, isRing?, isPoints?}
    this._initTextures();
  }

  async _initTextures() {
    try {
      this.sparkTex = await this.assets.loadTexture('assets/particles/spark_01.png');
      this.sparkTex.colorSpace = THREE.SRGBColorSpace;
    } catch (e) { /* optional */ }
    try {
      this.magicTex = await this.assets.loadTexture('assets/particles/magic_01.png');
      this.magicTex.colorSpace = THREE.SRGBColorSpace;
    } catch (e) { /* optional */ }
    try {
      this.puffTex = await this.assets.loadTexture('assets/particles/whitePuff04.png');
      this.puffTex.colorSpace = THREE.SRGBColorSpace;
    } catch (e) { /* optional */ }
  }

  // --- Capture: burst of spark sprites + a warm flash light ---
  captureBurst(worldPos) {
    const count = 18;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.sparkTex,
        color: new THREE.Color().setHSL(0.07 + Math.random() * 0.05, 1, 0.55),
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(worldPos);
      sp.position.y += 0.1;
      sp.scale.setScalar(0.14 + Math.random() * 0.1);
      this.scene.add(sp);
      const speed = 0.6 + Math.random() * 1.1;
      this.active.push({
        obj: sp,
        life: 1,
        decay: 0.02 + Math.random() * 0.025,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * speed,
          Math.random() * speed * 0.8,
          (Math.random() - 0.5) * speed,
        ),
        isSprite: true,
      });
    }
    // Flash light
    const light = new THREE.PointLight(0xffb060, 30, 6, 2);
    light.position.copy(worldPos);
    light.position.y += 0.3;
    this.scene.add(light);
    this.active.push({ obj: light, life: 1, decay: 0.09, isLight: true });
  }

  // --- Select: small magic glow puff ---
  selectPuff(worldPos) {
    if (!this.magicTex) return;
    const mat = new THREE.SpriteMaterial({
      map: this.magicTex,
      color: 0xc9a84c,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(worldPos);
    sp.position.y += 0.05;
    sp.scale.setScalar(0.3);
    this.scene.add(sp);
    this.active.push({ obj: sp, life: 1, decay: 0.03, isSprite: true, grow: 0.8 });
  }

  // --- Move: tiny smoke puff under the landing square ---
  movePuff(worldPos) {
    if (!this.puffTex) return;
    const mat = new THREE.SpriteMaterial({
      map: this.puffTex,
      color: 0x9a8a6a,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.position.copy(worldPos);
    sp.position.y += 0.05;
    sp.scale.setScalar(0.35);
    this.scene.add(sp);
    this.active.push({ obj: sp, life: 1, decay: 0.02, isSprite: true, grow: 1.4 });
  }

  // --- Check: pulsing red ring around the king ---
  checkRing(worldPos) {
    const ringGeo = new THREE.TorusGeometry(0.55, 0.035, 8, 40);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xcc3333, transparent: true, opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(worldPos);
    ring.position.y += 0.12;
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.active.push({ obj: ring, life: 1, decay: 0.012, isRing: true });
    // second, larger ring
    const ring2 = ring.clone();
    ring2.scale.setScalar(1.3);
    ring2.material = ringMat.clone();
    ring2.material.opacity = 0.5;
    this.scene.add(ring2);
    this.active.push({ obj: ring2, life: 1, decay: 0.012, isRing: true });
  }

  // --- Checkmate: grand burst + slow light swell ---
  checkmateBurst(worldPos) {
    this.captureBurst(worldPos);
    const light = new THREE.PointLight(0xffd080, 50, 12, 1.5);
    light.position.copy(worldPos);
    light.position.y += 0.8;
    this.scene.add(light);
    this.active.push({ obj: light, life: 1, decay: 0.008, isLight: true, big: true });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      a.life -= a.decay;
      if (a.life <= 0) {
        this._dispose(a.obj);
        this.active.splice(i, 1);
        continue;
      }
      if (a.isLight) {
        a.obj.intensity = (a.big ? 50 : 30) * a.life;
      } else if (a.isRing) {
        const p = 1 - a.life;
        a.obj.material.opacity = a.life * 0.85;
        a.obj.scale.setScalar(1 + p * 0.9);
        a.obj.rotation.z += dt * 1.2;
      } else if (a.isSprite) {
        if (a.vel) {
          a.obj.position.add(a.vel);
          a.vel.y -= dt * 2.2; // gravity
          a.vel.multiplyScalar(0.97);
        }
        if (a.grow) a.obj.scale.multiplyScalar(1 + a.grow * dt);
        a.obj.material.opacity = a.life * (a.vel ? 1 : 0.55);
      }
    }
  }

  _dispose(obj) {
    this.scene.remove(obj);
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (obj.material.map && obj.material.map !== this.sparkTex &&
          obj.material.map !== this.magicTex && obj.material.map !== this.puffTex) {
        obj.material.map.dispose();
      }
      obj.material.dispose();
    }
  }
}
