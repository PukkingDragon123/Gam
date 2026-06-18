// progression.js — persist discovered hidden islands + best scores.
// Storage access is guarded so the module is safe to import under node.
import { ISLANDS } from './config.js';

const STORAGE_KEY = 'brasilian-skies.save.v1';

function storage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    /* sandboxed / disabled */
  }
  return null;
}

export function defaultSave() {
  return { discovered: {}, highScore: 0, plays: 0, bestMultiplier: 1 };
}

export function load() {
  const s = storage();
  if (!s) return defaultSave();
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    return { ...defaultSave(), ...JSON.parse(raw) };
  } catch {
    return defaultSave();
  }
}

export function save(state) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

// Marks an island discovered. Returns true only the first time (so the UI can
// celebrate a genuinely new find).
export function discoverIsland(state, id) {
  if (state.discovered[id]) return false;
  state.discovered[id] = true;
  return true;
}

export function isDiscovered(state, id) {
  return !!state.discovered[id];
}

export function discoveredCount(state) {
  return ISLANDS.reduce((n, isl) => n + (state.discovered[isl.id] ? 1 : 0), 0);
}

export function recordRun(state, finalScore, bestMultiplier) {
  state.plays += 1;
  state.highScore = Math.max(state.highScore, Math.round(finalScore));
  state.bestMultiplier = Math.max(state.bestMultiplier || 1, bestMultiplier || 1);
  return state;
}
