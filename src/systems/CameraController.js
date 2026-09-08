/**
 * CameraController — cinematic intro + orbit + focus transitions + shake.
 */
import * as THREE from 'three';
import { CFG } from '../config.js';

export class CameraController {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.state = 'idle';         // idle | intro | orbit | focus
    this.introT = 0;
    this.focusFrom = new THREE.Vector3();
    this.focusTo = new THREE.Vector3();
    this.focusTargetFrom = new THREE.Vector3();
    this.focusTargetTo = new THREE.Vector3();
    this.focusT = 0;
    this.focusDur = 0.9;
    this.shakeT = 0;
    this.shakeMag = 0;
  }

  startIntro() {
    this.state = 'intro';
    this.introT = 0;
    this.controls.enabled = false;
    this.camera.position.set(...CFG.CAMERA.INTRO_START);
    this.controls.target.set(0, CFG.BOARD_OFFSET_Y + 0.4, 0);
  }

  toOrbit() {
    this.state = 'orbit';
    this.controls.enabled = true;
    this.controls.update();
  }

  resetView() {
    this.focusTo.set(0, 3.6, 7.2);
    this.focusTargetTo.set(0, CFG.BOARD_OFFSET_Y + 0.2, 0);
    this._startFocus(this.focusTo, this.focusTargetTo, 1.1);
  }

  focusOn(worldPos) {
    const target = worldPos.clone();
    target.y += 0.2;
    const camPos = worldPos.clone().add(new THREE.Vector3(1.6, 2.2, 3.2));
    this._startFocus(camPos, target, 0.9);
  }

  _startFocus(camPos, targetPos, dur) {
    this.state = 'focus';
    this.focusT = 0;
    this.focusDur = dur;
    this.focusFrom.copy(this.camera.position);
    this.focusTo.copy(camPos);
    this.focusTargetFrom.copy(this.controls.target);
    this.focusTargetTo.copy(targetPos);
  }

  shake(mag = 0.06, dur = 0.4) {
    this.shakeMag = mag;
    this.shakeT = dur;
  }

  update(dt) {
    if (this.state === 'intro') {
      this.introT += dt;
      const t = Math.min(this.introT / CFG.CAMERA.INTRO_DUR, 1);
      const e = t * t * (3 - 2 * t);
      const a = new THREE.Vector3(...CFG.CAMERA.INTRO_START);
      const b = new THREE.Vector3(...CFG.CAMERA.INTRO_END);
      this.camera.position.lerpVectors(a, b, e);
      this.camera.lookAt(0, CFG.BOARD_OFFSET_Y + 0.2, 0);
      if (t >= 1) this.toOrbit();
    } else if (this.state === 'focus') {
      this.focusT += dt;
      const t = Math.min(this.focusT / this.focusDur, 1);
      const e = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(this.focusFrom, this.focusTo, e);
      this.controls.target.lerpVectors(this.focusTargetFrom, this.focusTargetTo, e);
      this.controls.update();
      if (t >= 1) this.state = 'orbit';
    } else if (this.state === 'orbit') {
      this.controls.update();
    }

    // Camera shake (decaying random offset)
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const s = this.shakeMag * Math.max(0, this.shakeT) * 6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
  }
}
