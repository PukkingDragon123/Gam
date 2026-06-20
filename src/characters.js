// Fighter rosters.
//   HEROES   — the characters the player can pick (gated by their skill's XP unlock)
//   VILLAINS — the anime antagonists the CPU fights as (your opponent each match)
//
// Each fighter maps to one signature skill. Avatars are thematic emoji
// stand-ins (no copyrighted artwork is bundled).

import { ABILITY } from './constants.js';
import { unlockedAbilities } from './progression.js';

export const CHARACTERS = [
  {
    id: 'gojo',
    name: 'GOJO',
    jp: '五条 悟',
    side: 'hero',
    ability: ABILITY.BLIND,
    avatar: '🌀',
    theme: '#6fa8ff',
    move: 'Infinite Void',
    tagline: 'Overloads your senses — no telegraph.',
  },
  {
    id: 'saitama',
    name: 'SAITAMA',
    jp: 'サイタマ',
    side: 'hero',
    ability: ABILITY.FOCUS,
    avatar: '👊',
    theme: '#ffc24b',
    move: 'Serious Focus',
    tagline: 'Utterly calm. All the time in the world.',
  },
  {
    id: 'todoroki',
    name: 'TODOROKI',
    jp: '轟 焦凍',
    side: 'hero',
    ability: ABILITY.FREEZE,
    avatar: '🧊',
    theme: '#7fe0ff',
    move: 'Heaven-Piercing Ice',
    tagline: 'Freezes the moment — you get less time.',
  },
  {
    id: 'itachi',
    name: 'ITACHI',
    jp: 'うちは イタチ',
    side: 'hero',
    ability: ABILITY.REVERSE,
    avatar: '🔮',
    theme: '#c06bff',
    move: 'Tsukuyomi',
    tagline: 'Genjutsu — your read is a lie.',
  },
  {
    id: 'naruto',
    name: 'NARUTO',
    jp: 'うずまき ナルト',
    side: 'hero',
    ability: ABILITY.DOUBLE,
    avatar: '🍥',
    theme: '#ff9d3d',
    move: 'Shadow Clone',
    tagline: 'Two of him — strike twice in a row.',
  },
  {
    id: 'genos',
    name: 'GENOS',
    jp: 'ジェノス',
    side: 'hero',
    ability: ABILITY.DOUBLE,
    avatar: '🤖',
    theme: '#ff6a3d',
    move: 'Incinerate',
    tagline: 'Cyborg barrage — back-to-back cannons.',
  },
];

export const VILLAINS = [
  {
    id: 'frieza',
    name: 'FRIEZA',
    jp: 'フリーザ',
    side: 'villain',
    ability: ABILITY.FREEZE,
    avatar: '👾',
    theme: '#c98bff',
    move: 'Emperor’s Time',
    tagline: 'A cold tyrant — steals your reaction time.',
  },
  {
    id: 'madara',
    name: 'MADARA',
    jp: 'うちは マダラ',
    side: 'villain',
    ability: ABILITY.BLIND,
    avatar: '🌑',
    theme: '#ff5a5a',
    move: 'Infinite Tsukuyomi',
    tagline: 'Blots out the telegraph entirely.',
  },
  {
    id: 'aizen',
    name: 'AIZEN',
    jp: '藍染 惣右介',
    side: 'villain',
    ability: ABILITY.REVERSE,
    avatar: '🌫️',
    theme: '#b07bff',
    move: 'Kyōka Suigetsu',
    tagline: 'Perfect hypnosis — nothing is what it seems.',
  },
  {
    id: 'dio',
    name: 'DIO',
    jp: 'ディオ',
    side: 'villain',
    ability: ABILITY.DOUBLE,
    avatar: '🧛',
    theme: '#ffc24b',
    move: 'Knife Barrage',
    tagline: 'Throws twice before you can blink.',
  },
  {
    id: 'meruem',
    name: 'MERUEM',
    jp: 'メルエム',
    side: 'villain',
    ability: ABILITY.FOCUS,
    avatar: '🐜',
    theme: '#ff7bd0',
    move: 'Aura Read',
    tagline: 'Calm, overwhelming — reads everything.',
  },
  {
    id: 'cell',
    name: 'CELL',
    jp: 'セル',
    side: 'villain',
    ability: ABILITY.DOUBLE,
    avatar: '🦗',
    theme: '#6fe06f',
    move: 'Perfect Barrage',
    tagline: 'Relentless back-to-back assault.',
  },
];

const byId = Object.fromEntries([...CHARACTERS, ...VILLAINS].map((c) => [c.id, c]));

export function getCharacter(id) {
  return byId[id] || CHARACTERS[0];
}

/** Hero ids the player can pick at the given XP (gated by their skill). */
export function unlockedCharacters(xp) {
  const ab = new Set(unlockedAbilities(xp));
  return CHARACTERS.filter((c) => ab.has(c.ability)).map((c) => c.id);
}

/** Pick a random villain for the CPU to fight as. */
export function randomVillain(rng = Math.random) {
  return VILLAINS[Math.floor(rng() * VILLAINS.length)];
}
