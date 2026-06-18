// hands.js — webcam + MediaPipe HandLandmarker → smoothed gesture intent.
// MediaPipe is lazy-loaded from a CDN the first time the camera starts, so the
// rest of the game (and keyboard play) works with no network at all.
import { classifyHand, NO_HAND, GESTURE_DEFAULTS } from './gestures.js';

const VISION_VERSION = '0.10.14';
const VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}`;
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor() {
    this.video = null;
    this.stream = null;
    this.landmarker = null;
    this.ready = false;
    this.lastVideoTime = -1;
    this.lastLandmarks = null;

    this.center = { ...GESTURE_DEFAULTS.center };
    this.intent = NO_HAND;

    // smoothing / debounce state
    this._steer = 0;
    this._zone = 'center';
    this._zoneCand = 'center';
    this._zoneCount = 0;
    this._palm = false;
    this._fist = false;
    this._palmCount = 0;
    this._fistCount = 0;
  }

  async start(videoEl) {
    this.video = videoEl;
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    await new Promise((res) => {
      if (this.video.readyState >= 2) res();
      else this.video.onloadeddata = () => res();
    });

    const vision = await import(/* @vite-ignore */ VISION_URL);
    const { HandLandmarker, FilesetResolver } = vision;
    const fileset = await FilesetResolver.forVisionTasks(`${VISION_URL}/wasm`);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      numHands: 1,
      runningMode: 'VIDEO',
    });
    this.ready = true;
  }

  // Capture the current hand position as the neutral steering center.
  calibrate() {
    if (this.lastLandmarks) {
      const cls = classifyHand(this.lastLandmarks, { center: { x: 0.5, y: 0.5 } });
      this.center = { ...cls.center };
      return true;
    }
    return false;
  }

  // Call once per animation frame. Returns the current smoothed intent.
  update() {
    if (!this.ready || !this.video) return this.intent;
    const t = this.video.currentTime;
    if (t === this.lastVideoTime) return this.intent;
    this.lastVideoTime = t;

    let res;
    try {
      res = this.landmarker.detectForVideo(this.video, performance.now());
    } catch {
      return this.intent;
    }

    if (!res || !res.landmarks || res.landmarks.length === 0) {
      this.lastLandmarks = null;
      this.intent = NO_HAND;
      return this.intent;
    }

    const lm = res.landmarks[0];
    this.lastLandmarks = lm;
    const raw = classifyHand(lm, { center: this.center });

    // Smooth steering; debounce the discrete states so a single noisy frame
    // can't fire a jump/boost.
    this._steer += (raw.steer - this._steer) * 0.4;

    if (raw.vertical === this._zoneCand) this._zoneCount += 1;
    else {
      this._zoneCand = raw.vertical;
      this._zoneCount = 1;
    }
    if (this._zoneCount >= 2) this._zone = this._zoneCand;

    this._palmCount = raw.openPalm ? this._palmCount + 1 : 0;
    this._fistCount = raw.fist ? this._fistCount + 1 : 0;
    if (this._palmCount >= 2) this._palm = true;
    else if (!raw.openPalm) this._palm = false;
    if (this._fistCount >= 2) this._fist = true;
    else if (!raw.fist) this._fist = false;

    this.intent = {
      present: true,
      steer: this._steer,
      vertical: this._zone,
      openPalm: this._palm,
      fist: this._fist,
      extendedCount: raw.extendedCount,
      center: raw.center,
    };
    return this.intent;
  }

  stop() {
    this.ready = false;
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.landmarker && this.landmarker.close) {
      try {
        this.landmarker.close();
      } catch {
        /* ignore */
      }
    }
    this.landmarker = null;
  }
}
