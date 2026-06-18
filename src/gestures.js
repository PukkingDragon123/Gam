// gestures.js — pure hand-landmark → control-intent classifier.
// No browser/Three/MediaPipe imports, so it is unit-testable under `node --test`.
//
// Input is MediaPipe HandLandmarker's 21 normalized landmarks ({x,y,z} in [0,1],
// image space where y grows downward). Output is a coarse, smoothing-friendly
// intent the game can act on.
//
// Landmark indices (MediaPipe Hands):
//   0 wrist · 1-4 thumb · 5-8 index · 9-12 middle · 13-16 ring · 17-20 pinky
//   tips: 4,8,12,16,20 · PIP joints: 6,10,14,18 · MCP knuckles: 5,9,13,17

export const GESTURE_DEFAULTS = {
  center: { x: 0.5, y: 0.5 }, // neutral hand position (set at calibration)
  steerScale: 0.32, // half-range of hand travel that maps to full steer
  deadzoneX: 0.04, // ignore tiny horizontal jitter
  upThresh: 0.1, // raise this far above center → "up"
  downThresh: 0.1, // lower this far below center → "down"
  mirror: true, // selfie view: physical-right should read as screen-right
  extendFactor: 1.25, // tip-vs-knuckle distance ratio that counts as "extended"
};

const dist2d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Average of wrist + the four finger MCP knuckles — a stable "palm center".
export function palmCenter(lm) {
  const idx = [0, 5, 9, 13, 17];
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

// How many of the four long fingers are extended (thumb excluded — it's noisy).
export function extendedFingerCount(lm, factor = GESTURE_DEFAULTS.extendFactor) {
  const wrist = lm[0];
  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  let count = 0;
  for (const [tip, pip] of fingers) {
    if (dist2d(lm[tip], wrist) > dist2d(lm[pip], wrist) * factor) count += 1;
  }
  return count;
}

// Returns the full control intent for one detected hand.
export function classifyHand(lm, opts = {}) {
  const o = { ...GESTURE_DEFAULTS, ...opts, center: { ...GESTURE_DEFAULTS.center, ...(opts.center || {}) } };
  const c = palmCenter(lm);

  // Horizontal steering, signed [-1, 1].
  let dx = c.x - o.center.x;
  if (o.mirror) dx = -dx;
  let steer = clamp(dx / o.steerScale, -1, 1);
  if (Math.abs(steer) < o.deadzoneX / o.steerScale) steer = 0;

  // Vertical zone (image y grows downward → raising the hand lowers y).
  const dy = c.y - o.center.y;
  let vertical = 'center';
  if (dy < -o.upThresh) vertical = 'up';
  else if (dy > o.downThresh) vertical = 'down';

  const extended = extendedFingerCount(lm, o.extendFactor);
  const openPalm = extended >= 3;
  const fist = extended <= 1;

  return { present: true, steer, vertical, openPalm, fist, extendedCount: extended, center: c };
}

export const NO_HAND = Object.freeze({
  present: false,
  steer: 0,
  vertical: 'center',
  openPalm: false,
  fist: false,
  extendedCount: 0,
  center: null,
});
