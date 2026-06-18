// input.js — unify hand-gesture intent + keyboard into per-frame controls.
// `mergeControls` is pure (edge detection lives in an explicit state object) so
// it can be unit-tested; `createInput` wraps it with mutable state + DOM events.
import { NO_HAND } from './gestures.js';

export function initEdgeState() {
  return { jump: false, boost: false, fist: false, lastSteerSign: 1 };
}

export function emptyKeys() {
  return { left: false, right: false, up: false, down: false, boost: false, sharpLeft: false, sharpRight: false };
}

// prev: edge state · hand: gesture intent · keys: keyboard booleans.
// Returns { control, next } — `control` is what the game acts on this frame,
// `next` is the edge state to feed back in next frame.
export function mergeControls(prev, hand, keys) {
  const steerKey = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const steer = steerKey !== 0 ? steerKey : hand.present ? hand.steer : 0;
  const steerSign = steer > 0.15 ? 1 : steer < -0.15 ? -1 : prev.lastSteerSign;

  const jumpSrc = (hand.present && hand.vertical === 'up') || keys.up;
  const crouch = (hand.present && hand.vertical === 'down') || keys.down;
  const boostSrc = (hand.present && hand.openPalm) || keys.boost;
  const fistSrc = (hand.present && hand.fist) || keys.sharpLeft || keys.sharpRight;

  const jump = jumpSrc && !prev.jump;
  const boost = boostSrc && !prev.boost;
  let sharpTurn = 0;
  if (fistSrc && !prev.fist) {
    sharpTurn = keys.sharpLeft ? -1 : keys.sharpRight ? 1 : steerSign;
  }

  return {
    control: { steer, jump, crouch, boost, sharpTurn },
    next: { jump: jumpSrc, boost: boostSrc, fist: fistSrc, lastSteerSign: steerSign },
  };
}

// Maps a KeyboardEvent.code to one of our logical key flags.
export function codeToKey(code) {
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'boost';
    case 'KeyQ':
      return 'sharpLeft';
    case 'KeyE':
      return 'sharpRight';
    default:
      return null;
  }
}

export function createInput() {
  let edge = initEdgeState();
  let hand = NO_HAND;
  const keys = emptyKeys();

  const onKey = (down) => (e) => {
    const k = codeToKey(e.code);
    if (!k) return;
    if (e.code === 'Space') e.preventDefault();
    keys[k] = down;
  };
  const kd = onKey(true);
  const ku = onKey(false);

  return {
    setHand(h) {
      hand = h || NO_HAND;
    },
    sample() {
      const { control, next } = mergeControls(edge, hand, keys);
      edge = next;
      return control;
    },
    attach(target = window) {
      target.addEventListener('keydown', kd);
      target.addEventListener('keyup', ku);
    },
    detach(target = window) {
      target.removeEventListener('keydown', kd);
      target.removeEventListener('keyup', ku);
    },
    _keys: keys,
  };
}
