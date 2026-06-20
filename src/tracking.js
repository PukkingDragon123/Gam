// Webcam tracking via MediaPipe — head OR hand.
//
// The game only needs a coarse direction (up/down/left/right/center). In head
// mode we track the nose tip; in hand mode we track the palm. Both are measured
// as an offset from a calibrated centre, the video is mirrored like a real
// mirror, and MediaPipe is imported lazily so keyboard mode stays offline.

const MP_VERSION = '0.10.12';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const NOSE_TIP = 1; // FaceLandmarker nose-tip index
const PALM = 9; // HandLandmarker middle-finger MCP ≈ palm centre

const EMA = 0.45; // position smoothing
const DEADZONE = { head: 0.045, hand: 0.06 }; // hand swings wider, needs a bigger dead-zone

export class CameraTracker {
  /** @param {'head'|'hand'} mode */
  constructor(mode = 'head') {
    this.mode = mode;
    this.video = null; // private offscreen detection video
    this.landmarker = null;
    this.stream = null;
    this.running = false;
    this._raf = 0;

    this.center = { x: 0.5, y: 0.5 };
    this.smoothed = { x: 0.5, y: 0.5 };
    this.tracked = false; // face/hand currently detected
    this._lastVideoTime = -1;

    /** Optional callback(state) invoked each processed frame. */
    this.onFrame = null;
  }

  static isSupported() {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia
    );
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });

    const v = document.createElement('video');
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    v.style.cssText = 'position:fixed;width:2px;height:2px;left:-9999px;top:0;opacity:0;';
    document.body.appendChild(v);
    v.srcObject = this.stream;
    await v.play();
    this.video = v;

    const vision = await import(VISION_URL);
    const { FaceLandmarker, HandLandmarker, FilesetResolver } = vision;
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

    if (this.mode === 'hand') {
      this.landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 1,
      });
    } else {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    }

    this.running = true;
    this._loop();
  }

  attachDisplay(videoEl) {
    if (!videoEl || !this.stream) return;
    videoEl.srcObject = this.stream;
    const p = videoEl.play();
    if (p && p.catch) p.catch(() => {});
  }

  _point(result) {
    if (this.mode === 'hand') {
      const hands = result?.landmarks;
      if (hands && hands.length > 0) return hands[0][PALM];
      return null;
    }
    const faces = result?.faceLandmarks;
    if (faces && faces.length > 0) return faces[0][NOSE_TIP];
    return null;
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

    const pt = this._point(result);
    if (pt) {
      const x = 1 - pt.x; // mirror so physical-right === screen-right
      const y = pt.y;
      this.smoothed.x += (x - this.smoothed.x) * EMA;
      this.smoothed.y += (y - this.smoothed.y) * EMA;
      this.tracked = true;
    } else {
      this.tracked = false;
    }

    if (this.onFrame) this.onFrame(this.getState());
  }

  calibrate() {
    this.center = { x: this.smoothed.x, y: this.smoothed.y };
  }

  getOffset() {
    return { dx: this.smoothed.x - this.center.x, dy: this.smoothed.y - this.center.y };
  }

  /** @returns {'up'|'down'|'left'|'right'|'center'} */
  getDirection() {
    if (!this.tracked) return 'center';
    const { dx, dy } = this.getOffset();
    if (Math.hypot(dx, dy) < (DEADZONE[this.mode] ?? 0.05)) return 'center';
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
    return dy > 0 ? 'down' : 'up';
  }

  getState() {
    return {
      mode: this.mode,
      hasFace: this.tracked, // kept for API compatibility with callers
      tracked: this.tracked,
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

// Back-compat alias (older imports referenced HeadTracker).
export { CameraTracker as HeadTracker };
