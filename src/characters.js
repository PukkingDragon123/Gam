// Fighter roster. Each character maps to one signature skill, and which
// characters you can pick is gated by the same XP that unlocks their skill.
//
// Names are real anime characters (per request); avatars are thematic emoji
// stand-ins (no copyrighted artwork is bundled).

import { ABILITY } from './constants.js';
import { unlockedAbilities } from './progression.js';

export const CHARACTERS = [
  {
    id: 'gojo',
    name: 'GOJO',
    jp: '五条 悟',
    ability: ABILITY.BLIND,
    avatar: '🌀',
    theme: '#7fdcff',
    move: 'Infinite Void',
    tagline: 'Overloads your senses — no telegraph.',
  },
  {
    id: 'saitama',
    name: 'SAITAMA',
    jp: 'サイタマ',
    ability: ABILITY.FOCUS,
    avatar: '👊',
    theme: '#ffd23d',
    move: 'Serious Focus',
    tagline: 'Utterly calm. All the time in the world.',
  },
  {
    id: 'dio',
    name: 'DIO',
    jp: 'ディオ',
    ability: ABILITY.FREEZE,
    avatar: '🧛',
    theme: '#f5c542',
    move: 'THE WORLD',
    tagline: 'Stops time — you get less of it.',
  },
  {
    id: 'aizen',
    name: 'AIZEN',
    jp: '藍染 惣右介',
    ability: ABILITY.REVERSE,
    avatar: '🌫️',
    theme: '#b07bff',
    move: 'Kyōka Suigetsu',
    tagline: 'Perfect hypnosis — your read is a lie.',
  },
  {
    id: 'naruto',
    name: 'NARUTO',
    jp: 'うずまき ナルト',
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
    ability: ABILITY.DOUBLE,
    avatar: '🤖',
    theme: '#ff6a3d',
    move: 'Incinerate',
    tagline: 'Cyborg barrage — back-to-back cannons.',
  },
];

const byId = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id) {
  return byId[id] || CHARACTERS[0];
}

/** Character ids available at the given XP (gated by their skill's unlock). */
export function unlockedCharacters(xp) {
  const ab = new Set(unlockedAbilities(xp));
  return CHARACTERS.filter((c) => ab.has(c.ability)).map((c) => c.id);
}

/** Pick a random character, optionally excluding one (to avoid mirror matches). */
export function randomCharacter(excludeId = null, rng = Math.random) {
  const pool = CHARACTERS.filter((c) => c.id !== excludeId);
  const list = pool.length ? pool : CHARACTERS;
  return list[Math.floor(rng() * list.length)];
}
