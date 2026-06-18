// Headless unit tests for the pure modules — no browser, no Three, no MediaPipe.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyHand, extendedFingerCount, palmCenter } from '../src/gestures.js';
import {
  createScore,
  multiplierFromRings,
  scoreNote,
  scoreRing,
  scoreJump,
  decayCombo,
  resetCombo,
  dayPhase,
  nightFactor,
  lerpColor,
  lerpPalette,
} from '../src/scoring.js';
import { mergeControls, initEdgeState, emptyKeys, codeToKey } from '../src/input.js';
import * as progression from '../src/progression.js';
import { ISLANDS, PALETTES, ALBUM } from '../src/config.js';

// Build 21 synthetic hand landmarks around a palm center, with the four long
// fingers either extended (tips far from wrist) or curled (tips near wrist).
function buildHand({ cx = 0.5, cy = 0.5, extended = true } = {}) {
  const lm = new Array(21).fill(null).map(() => ({ x: cx, y: cy, z: 0 }));
  lm[0] = { x: cx, y: cy, z: 0 }; // wrist
  // MCP knuckles (5,9,13,17) clustered near center so palmCenter ≈ (cx, cy)
  for (const i of [5, 9, 13, 17]) lm[i] = { x: cx + (i - 11) * 0.01, y: cy, z: 0 };
  // thumb chain — irrelevant to the long-finger count
  for (const i of [1, 2, 3, 4]) lm[i] = { x: cx - 0.1, y: cy + 0.02, z: 0 };
  // index/middle/ring/pinky: tip + pip
  const tipY = extended ? cy - 0.35 : cy - 0.05;
  const pipY = extended ? cy - 0.12 : cy - 0.08;
  const pairs = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  let k = 0;
  for (const [tip, pip] of pairs) {
    const off = (k - 1.5) * 0.03;
    lm[tip] = { x: cx + off, y: tipY, z: 0 };
    lm[pip] = { x: cx + off, y: pipY, z: 0 };
    k++;
  }
  return lm;
}

// ───────────────────────── gestures ─────────────────────────
test('open palm vs closed fist', () => {
  assert.equal(extendedFingerCount(buildHand({ extended: true })), 4);
  assert.equal(extendedFingerCount(buildHand({ extended: false })), 0);

  const open = classifyHand(buildHand({ extended: true }));
  assert.equal(open.openPalm, true);
  assert.equal(open.fist, false);

  const fist = classifyHand(buildHand({ extended: false }));
  assert.equal(fist.fist, true);
  assert.equal(fist.openPalm, false);
});

test('palm center averages wrist + knuckles', () => {
  const c = palmCenter(buildHand({ cx: 0.4, cy: 0.6 }));
  assert.ok(Math.abs(c.x - 0.4) < 0.02);
  assert.ok(Math.abs(c.y - 0.6) < 0.02);
});

test('steering: centered is dead, off-center clamps to [-1,1]', () => {
  const center = { x: 0.5, y: 0.5 };
  assert.equal(classifyHand(buildHand({ cx: 0.5 }), { center }).steer, 0);

  const right = classifyHand(buildHand({ cx: 0.95 }), { center, mirror: false }).steer;
  const left = classifyHand(buildHand({ cx: 0.05 }), { center, mirror: false }).steer;
  assert.ok(right > 0.5 && right <= 1);
  assert.ok(left < -0.5 && left >= -1);

  // mirror flips the sign (selfie view)
  const mirrored = classifyHand(buildHand({ cx: 0.95 }), { center, mirror: true }).steer;
  assert.ok(mirrored < 0);
});

test('vertical zones: raise → up, lower → down', () => {
  const center = { x: 0.5, y: 0.5 };
  assert.equal(classifyHand(buildHand({ cy: 0.2 }), { center }).vertical, 'up');
  assert.equal(classifyHand(buildHand({ cy: 0.8 }), { center }).vertical, 'down');
  assert.equal(classifyHand(buildHand({ cy: 0.5 }), { center }).vertical, 'center');
});

// ───────────────────────── scoring ─────────────────────────
test('combo multiplier scales and caps', () => {
  assert.equal(multiplierFromRings(0), 1);
  assert.equal(multiplierFromRings(1), 1.25);
  assert.equal(multiplierFromRings(8), 3);
  assert.equal(multiplierFromRings(999), 3); // capped at maxCombo
});

test('scoring notes/rings/jumps and combo decay', () => {
  const s = createScore();
  scoreNote(s);
  assert.equal(s.score, 100);
  scoreRing(s); // rings=1 → mult 1.25, +250*1.25=313 (rounded)
  assert.equal(s.rings, 1);
  assert.equal(s.multiplier, 1.25);
  assert.equal(s.score, 100 + 313);
  assert.equal(s.bestMultiplier, 1.25);
  scoreNote(s); // now worth 100*1.25=125
  assert.equal(s.score, 100 + 313 + 125);
  scoreJump(s);
  assert.equal(s.jumps, 1);
  decayCombo(s);
  assert.equal(s.rings, 0);
  assert.equal(s.multiplier, 1);
  // bestMultiplier is sticky
  assert.equal(s.bestMultiplier, 1.25);
});

test('resetCombo wipes the streak but not best', () => {
  const s = createScore();
  scoreRing(s);
  scoreRing(s);
  resetCombo(s);
  assert.equal(s.rings, 0);
  assert.equal(s.multiplier, 1);
  assert.ok(s.bestMultiplier > 1);
});

test('day phase wraps and night factor peaks at night', () => {
  assert.equal(dayPhase(0, 60), 0);
  assert.ok(Math.abs(dayPhase(90, 60) - 0.5) < 1e-9);
  assert.ok(nightFactor(0.78) > 0.95);
  assert.ok(nightFactor(0.0) < 0.05);
  assert.ok(nightFactor(0.78) > nightFactor(0.4));
});

test('color + palette interpolation', () => {
  assert.equal(lerpColor(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(lerpColor(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(lerpColor(0x000000, 0xffffff, 0.5), 0x808080); // round(127.5) → 128

  const pal = lerpPalette(0.5);
  assert.equal(pal.sky.length, 2);
  assert.equal(pal.water.length, 2);
  assert.ok(pal.light >= 0 && pal.light <= 1.2);
  assert.equal(typeof pal.name, 'string');
});

// ───────────────────────── input merge ─────────────────────────
const NO = { present: false, steer: 0, vertical: 'center', openPalm: false, fist: false };

test('keyboard steering and jump edge', () => {
  const keys = emptyKeys();
  keys.right = true;
  let { control } = mergeControls(initEdgeState(), NO, keys);
  assert.equal(control.steer, 1);

  keys.up = true;
  let res = mergeControls(initEdgeState(), NO, keys);
  assert.equal(res.control.jump, true); // rising edge
  res = mergeControls(res.next, NO, keys);
  assert.equal(res.control.jump, false); // still held → no repeat
});

test('hand gestures map to controls', () => {
  const keys = emptyKeys();
  const up = mergeControls(initEdgeState(), { ...NO, present: true, vertical: 'up' }, keys);
  assert.equal(up.control.jump, true);

  const palm = mergeControls(initEdgeState(), { ...NO, present: true, openPalm: true }, keys);
  assert.equal(palm.control.boost, true);

  const crouch = mergeControls(initEdgeState(), { ...NO, present: true, vertical: 'down' }, keys);
  assert.equal(crouch.control.crouch, true);

  const fist = mergeControls(initEdgeState(), { ...NO, present: true, fist: true, steer: 0.6 }, keys);
  assert.equal(fist.control.sharpTurn, 1); // dashes toward the lean direction
});

test('codeToKey maps the documented keys', () => {
  assert.equal(codeToKey('ArrowLeft'), 'left');
  assert.equal(codeToKey('KeyD'), 'right');
  assert.equal(codeToKey('Space'), 'up');
  assert.equal(codeToKey('ShiftLeft'), 'boost');
  assert.equal(codeToKey('KeyQ'), 'sharpLeft');
  assert.equal(codeToKey('Tab'), null);
});

// ───────────────────────── progression ─────────────────────────
test('island discovery is first-time only', () => {
  const save = progression.defaultSave();
  assert.equal(progression.discoverIsland(save, 'rio'), true);
  assert.equal(progression.discoverIsland(save, 'rio'), false);
  assert.equal(progression.isDiscovered(save, 'rio'), true);
  assert.equal(progression.discoveredCount(save), 1);
});

test('recordRun keeps the best', () => {
  const save = progression.defaultSave();
  progression.recordRun(save, 500, 2);
  progression.recordRun(save, 300, 1.5);
  assert.equal(save.highScore, 500);
  assert.equal(save.bestMultiplier, 2);
  assert.equal(save.plays, 2);
});

// ───────────────────────── config integrity ─────────────────────────
test('content data is well-formed', () => {
  assert.equal(ISLANDS.length, 6);
  const ids = new Set(ISLANDS.map((i) => i.id));
  assert.equal(ids.size, ISLANDS.length); // unique ids
  assert.equal(ALBUM.tracks.length, 8);
  // palette stops are sorted and span [0,1]
  for (let i = 1; i < PALETTES.length; i++) assert.ok(PALETTES[i].at >= PALETTES[i - 1].at);
  assert.equal(PALETTES[0].at, 0);
  assert.equal(PALETTES[PALETTES.length - 1].at, 1);
});
