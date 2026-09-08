/**
 * AssetManager — GLB / texture cache with lazy loading.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetManager {
  constructor() {
    this.gltfs = new Map();
    this.textures = new Map();
    this._gltfLoader = new GLTFLoader();
  }

  async loadGLB(path) {
    if (this.gltfs.has(path)) return this.gltfs.get(path);
    const gltf = await new Promise((resolve, reject) => {
      this._gltfLoader.load(path, resolve, undefined, reject);
    });
    this.gltfs.set(path, gltf);
    return gltf;
  }

  async loadTexture(path, srgb = false) {
    if (this.textures.has(path)) return this.textures.get(path);
    const tex = await new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(path, resolve, undefined, reject);
    });
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    this.textures.set(path, tex);
    return tex;
  }
}
