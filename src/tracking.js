// Webcam head tracking via MediaPipe FaceLandmarker.
//
// The game only needs a coarse direction (up/down/left/right/center), so we
// track the nose tip's position relative to a calibrated centre. The video is
// mirrored like a real mirror, so the player's physical right maps to screen
// right, which feels natural for dodging.
//
// MediaPipe is imported lazily the first time the camera starts, which keeps
// keyboard mode fully offline and instant.

const MP_VERSION = '0.10.12';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

const NOSE_TIP = 1; // MediaPipe FaceMesh nose-tip landmark index
const EMA = 0.45; // smoothing factor for the nose position
const DEADZONE = 0.045; // normalized distance below which we report 'center'

export class HeadTracker {
  constructor() {
    this.video = null; // internal detection video (offscreen, always playing)
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this._raf = 0;

    this.center = { x: 0.5, y: 0.5 };
    this.smoothed = { x: 0.5, y: 0.5 };
    this.hasFace = false;
    this._lastVideoTime = -1;

    /** Optional callback(state) invoked each processed frame. */
    this.onFrame = null;
  }

  /** True if the browser can plausibly run camera mode. */
  static isSupported() {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia
    );
  }

  /**
   * Acquire the camera and initialise the landmarker. Detection runs against a
   * private offscreen video element so it keeps working no matter which screen
   * (calibrate or game) is currently visible. Use attachDisplay() to mirror the
   * feed onto a visible element.
   */
  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    const v = document.createElement('video');
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    // Kept on-page but out of sight so the browser keeps decoding frames.
    v.style.cssText = 'position:fixed;width:2px;height:2px;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(v);
    v.srcObject = this.stream;
    await v.play();
    this.video = v;

    const { FaceLandmarker, FilesetResolver } = await import(VISION_URL);
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
    });

    this.running = true;
    this._loop();
  }

  /** Mirror the live camera stream onto a visible <video> element. */
  attachDisplay(videoEl) {
    if (!videoEl || !this.stream) return;
    videoEl.srcObject = this.stream;
    const p = videoEl.play();
    if (p && p.catch) p.catch(() => {});
  }

  _loop() {
    if (!this.running) return;
    this._raf = requestAnimationFrame(() => this._loop());

    const v = this.video;
    if (!v || v.readyState < 2 || v.currentTime === this._lastVideoTime) return;
    this._lastVideoTime = v.currentTime;

    let result;
    try {
      result = this.landmarker.detectForVideo(v, performance.now());
    } catch {
      return;
    }

    const faces = result?.faceLandmarks;
    if (faces && faces.length > 0) {
      const nose = faces[0][NOSE_TIP];
      // Mirror X so physical-right === screen-right.
      const x = 1 - nose.x;
      const y = nose.y;
      this.smoothed.x = this.smoothed.x + (x - this.smoothed.x) * EMA;
      this.smoothed.y = this.smoothed.y + (y - this.smoothed.y) * EMA;
      this.hasFace = true;
    } else {
      this.hasFace = false;
    }

    if (this.onFrame) this.onFrame(this.getState());
  }

  /** Capture the current head position as the neutral centre. */
  calibrate() {
    this.center = { x: this.smoothed.x, y: this.smoothed.y };
  }

  /** Offset of the head from calibrated centre, in normalized units. */
  getOffset() {
    return { dx: this.smoothed.x - this.center.x, dy: this.smoothed.y - this.center.y };
  }

  /**
   * Current coarse direction.
   * @returns {'up'|'down'|'left'|'right'|'center'}
   */
  getDirection() {
    if (!this.hasFace) return 'center';
    const { dx, dy } = this.getOffset();
    if (Math.hypot(dx, dy) < DEADZONE) return 'center';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  getState() {
    return {
      hasFace: this.hasFace,
      direction: this.getDirection(),
      offset: this.getOffset(),
      smoothed: { ...this.smoothed },
    };
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.video && this.video.parentNode) {
      this.video.srcObject = null;
      this.video.remove();
    }
    this.video = null;
    if (this.landmarker?.close) {
      try {
        this.landmarker.close();
      } catch {
        /* ignore */
      }
    }
    this.landmarker = null;
  }
}
