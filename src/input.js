// Direction sources. The game loop only calls getDirection(); whether that
// comes from a tracked head or the arrow keys is an implementation detail.

import { HeadTracker } from './tracking.js';

const KEY_MAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

/** Keyboard fallback — fully offline, great for testing. */
export class KeyboardSource {
  constructor() {
    this.held = 'center';
    this.mode = 'keyboard';
    this._down = (e) => {
      const dir = KEY_MAP[e.key];
      if (dir) {
        this.held = dir;
        e.preventDefault();
      }
    };
    this._up = (e) => {
      const dir = KEY_MAP[e.key];
      if (dir && this.held === dir) this.held = 'center';
    };
  }

  async start() {
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
  }

  getDirection() {
    return this.held;
  }

  getState() {
    return { hasFace: true, direction: this.held };
  }

  // No-ops so the camera and keyboard sources share an interface.
  calibrate() {}

  stop() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
}

/** Camera source — thin adapter over HeadTracker. */
export class CameraSource {
  constructor() {
    this.tracker = new HeadTracker();
    this.mode = 'camera';
  }

  async start(displayEl) {
    await this.tracker.start();
    if (displayEl) this.tracker.attachDisplay(displayEl);
  }

  attachDisplay(displayEl) {
    this.tracker.attachDisplay(displayEl);
  }

  set onFrame(cb) {
    this.tracker.onFrame = cb;
  }
  get onFrame() {
    return this.tracker.onFrame;
  }

  getDirection() {
    return this.tracker.getDirection();
  }

  getState() {
    return this.tracker.getState();
  }

  calibrate() {
    this.tracker.calibrate();
  }

  stop() {
    this.tracker.stop();
  }
}

export { HeadTracker };
