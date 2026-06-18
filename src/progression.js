// Player progression: XP, ability/arena/cosmetic unlocks. Persisted to
// localStorage in the browser; falls back to an in-memory store elsewhere.

import { ABILITY, RANKS, XP } from './constants.js';

const STORAGE_KEY = 'sbu.profile.v1';

/** Abilities available from the very start; the rest unlock with XP. */
const STARTING_ABILITIES = [ABILITY.BLIND, ABILITY.FOCUS];

/** XP thresholds at which each locked ability becomes available. */
export const ABILITY_UNLOCKS = [
  { id: ABILITY.FREEZE, minXp: 80, name: 'Freeze' },
  { id: ABILITY.REVERSE, minXp: 220, name: 'Reverse' },
  { id: ABILITY.DOUBLE, minXp: 500, name: 'Double Turn' },
];

/** Arenas (background themes) unlocked by XP. */
export const ARENAS = [
  { id: 'dojo', name: 'Neon Dojo', minXp: 0 },
  { id: 'rooftop', name: 'Rooftop', minXp: 120 },
  { id: 'arena', name: 'Title Arena', minXp: 350 },
  { id: 'void', name: 'The Void', minXp: 900 },
];

/** Cosmetic glove trails unlocked by XP. */
export const COSMETICS = [
  { id: 'classic', name: 'Classic', minXp: 0 },
  { id: 'ember', name: 'Ember Trail', minXp: 200 },
  { id: 'frost', name: 'Frost Trail', minXp: 450 },
  { id: 'gold', name: 'Champion Gold', minXp: 1200 },
];

const _memory = { value: null };

function read() {
  if (_memory.value) return _memory.value;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        _memory.value = JSON.parse(raw);
        return _memory.value;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  _memory.value = { xp: 0, matches: 0, wins: 0, selected: { arena: 'dojo', cosmetic: 'classic' } };
  return _memory.value;
}

function write(profile) {
  _memory.value = profile;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  } catch {
    /* storage may be unavailable (private mode) — memory still holds */
  }
}

export function getProfile() {
  return { ...read() };
}

/** Current rank object based on XP. */
export function rankForXp(xp) {
  let current = RANKS[0];
  for (const r of RANKS) if (xp >= r.minXp) current = r;
  return current;
}

/** Next rank object, or null at the top. */
export function nextRank(xp) {
  const idx = RANKS.findIndex((r) => r.id === rankForXp(xp).id);
  return RANKS[idx + 1] ?? null;
}

/** List of unlocked ability ids for the given XP. */
export function unlockedAbilities(xp) {
  const unlocked = [...STARTING_ABILITIES];
  for (const a of ABILITY_UNLOCKS) if (xp >= a.minXp) unlocked.push(a.id);
  return unlocked;
}

function unlockedByXp(list, xp) {
  return list.filter((item) => xp >= item.minXp).map((item) => item.id);
}

export function unlockedArenas(xp) {
  return unlockedByXp(ARENAS, xp);
}

export function unlockedCosmetics(xp) {
  return unlockedByXp(COSMETICS, xp);
}

/**
 * Compute XP earned for a finished match.
 * @param {{ won: boolean, hitsLanded: number, dodges: number }} stats
 */
export function xpForMatch({ won, hitsLanded, dodges }) {
  return (
    XP.perMatch +
    hitsLanded * XP.perHitLanded +
    dodges * XP.perDodge +
    (won ? XP.winBonus : 0)
  );
}

/**
 * Record a completed match. Returns a summary including any new unlocks so the
 * UI can celebrate them.
 * @param {{ won: boolean, hitsLanded: number, dodges: number }} stats
 */
export function recordMatch(stats) {
  const profile = read();
  const before = {
    abilities: unlockedAbilities(profile.xp),
    arenas: unlockedArenas(profile.xp),
    cosmetics: unlockedCosmetics(profile.xp),
    rank: rankForXp(profile.xp),
  };

  const gained = xpForMatch(stats);
  profile.xp += gained;
  profile.matches += 1;
  if (stats.won) profile.wins += 1;
  write(profile);

  const after = {
    abilities: unlockedAbilities(profile.xp),
    arenas: unlockedArenas(profile.xp),
    cosmetics: unlockedCosmetics(profile.xp),
    rank: rankForXp(profile.xp),
  };

  return {
    gained,
    totalXp: profile.xp,
    rankedUp: before.rank.id !== after.rank.id ? after.rank : null,
    newAbilities: after.abilities.filter((id) => !before.abilities.includes(id)),
    newArenas: after.arenas.filter((id) => !before.arenas.includes(id)),
    newCosmetics: after.cosmetics.filter((id) => !before.cosmetics.includes(id)),
  };
}

export function setSelection(key, value) {
  const profile = read();
  profile.selected = { ...profile.selected, [key]: value };
  write(profile);
}

/** Wipe the profile (used by the reset button / tests). */
export function resetProfile() {
  _memory.value = null;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return getProfile();
}
