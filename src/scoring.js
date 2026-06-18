// scoring.js — pure score / combo / day-night math. Unit-testable under node.
import { SCORE, PALETTES } from './config.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ───────────────────────── Score & combo ─────────────────────────
export function createScore() {
  return {
    score: 0,
    notes: 0,
    rings: 0, // current ring streak (combo steps)
    jumps: 0,
    islands: 0,
    multiplier: 1,
    bestMultiplier: 1,
  };
}

export function multiplierFromRings(rings) {
  return 1 + Math.min(rings, SCORE.maxCombo) * SCORE.comboStep;
}

export function scoreNote(s) {
  s.notes += 1;
  s.score += Math.round(SCORE.note * s.multiplier);
  return s;
}

export function scoreRing(s) {
  s.rings += 1;
  s.multiplier = multiplierFromRings(s.rings);
  s.bestMultiplier = Math.max(s.bestMultiplier, s.multiplier);
  s.score += Math.round(SCORE.ring * s.multiplier);
  return s;
}

export function scoreJump(s) {
  s.jumps += 1;
  s.score += Math.round(SCORE.trickPerJump * s.multiplier);
  return s;
}

export function scoreIsland(s) {
  s.islands += 1;
  s.score += SCORE.islandDiscovery;
  return s;
}

// A wipeout (hitting an obstacle) is gentle in this cozy game: just lose the
// ring streak, never the run.
export function resetCombo(s) {
  s.rings = 0;
  s.multiplier = 1;
  return s;
}

// One step of natural combo decay when the streak goes unfed.
export function decayCombo(s) {
  if (s.rings > 0) {
    s.rings -= 1;
    s.multiplier = multiplierFromRings(s.rings);
  }
  return s;
}

// ───────────────────────── Day / night ─────────────────────────
export function dayPhase(elapsed, dayLength) {
  const t = (elapsed % dayLength) / dayLength;
  return t < 0 ? t + 1 : t;
}

export function angularDist(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
}

// 0 in daylight → 1 at the heart of night (~t=0.78). Smooth, wraps cleanly.
export function nightFactor(t) {
  const x = clamp(1 - angularDist(t, 0.78) / 0.22, 0, 1);
  return x * x * (3 - 2 * x); // smoothstep
}

export function lerpColor(a, b, f) {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * f);
  const g = Math.round(ag + (bg - ag) * f);
  const bl = Math.round(ab + (bb - ab) * f);
  return (r << 16) | (g << 8) | bl;
}

// Interpolate the palette stops for phase t∈[0,1) into a concrete palette.
export function lerpPalette(t) {
  let i = 0;
  for (let k = 0; k < PALETTES.length - 1; k++) {
    if (t >= PALETTES[k].at && t <= PALETTES[k + 1].at) {
      i = k;
      break;
    }
  }
  const a = PALETTES[i];
  const b = PALETTES[i + 1] || PALETTES[i];
  const span = b.at - a.at || 1;
  const f = clamp((t - a.at) / span, 0, 1);
  return {
    name: f < 0.5 ? a.name : b.name,
    sky: [lerpColor(a.sky[0], b.sky[0], f), lerpColor(a.sky[1], b.sky[1], f)],
    water: [lerpColor(a.water[0], b.water[0], f), lerpColor(a.water[1], b.water[1], f)],
    sun: lerpColor(a.sun, b.sun, f),
    fog: lerpColor(a.fog, b.fog, f),
    light: a.light + (b.light - a.light) * f,
  };
}
