// Core constants and tuning tables for Shadow Boxing Ultimate.
// This module is pure data — safe to import in the browser or in Node.

export const DIRECTIONS = /** @type {const} */ (['up', 'down', 'left', 'right']);

/** Opposite direction map, used by the Reverse ability. */
export const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

/** Result of resolving one exchange. */
export const RESULT = {
  HIT: 'hit',
  DODGE: 'dodge',
};

/** Ability identifiers. */
export const ABILITY = {
  NONE: 'none',
  FREEZE: 'freeze',
  REVERSE: 'reverse',
  BLIND: 'blind',
  DOUBLE: 'double',
  FOCUS: 'focus',
};

/**
 * Ability definitions.
 * `side` describes when the ability is meaningfully used:
 *   - 'attack'  : activated by the attacker, distorts the defender's turn.
 *   - 'defend'  : activated by the defender, helps the defender.
 * `uses` is the number of activations available per match.
 */
export const ABILITIES = {
  [ABILITY.FREEZE]: {
    id: ABILITY.FREEZE,
    name: 'Freeze',
    side: 'attack',
    uses: 2,
    icon: '❄️',
    blurb: 'The opponent has less time to react to your attack.',
  },
  [ABILITY.REVERSE]: {
    id: ABILITY.REVERSE,
    name: 'Reverse',
    side: 'attack',
    uses: 2,
    icon: '🔄',
    blurb: 'The direction indicator shown to the opponent is reversed.',
  },
  [ABILITY.BLIND]: {
    id: ABILITY.BLIND,
    name: 'Blind',
    side: 'attack',
    uses: 1,
    icon: '🌑',
    blurb: 'Hide the direction indicator from the opponent for one turn.',
  },
  [ABILITY.DOUBLE]: {
    id: ABILITY.DOUBLE,
    name: 'Double Turn',
    side: 'attack',
    uses: 1,
    icon: '⚡',
    blurb: 'Attack twice in a row instead of passing the turn.',
  },
  [ABILITY.FOCUS]: {
    id: ABILITY.FOCUS,
    name: 'Focus',
    side: 'defend',
    uses: 2,
    icon: '🎯',
    blurb: 'Slow the turn down for yourself — more time to read and dodge.',
  },
};

/**
 * Ranked ladder. Higher ranks shrink the reaction window so play shifts from
 * reaction toward prediction, exactly as described in the design doc.
 * `defendTimeMs`  : base reaction window for the defender.
 * `attackTimeMs`  : window for the attacker to choose a direction.
 * `minXp`         : XP required to be seated at this rank.
 */
export const RANKS = [
  { id: 'rookie', name: 'Rookie', defendTimeMs: 2600, attackTimeMs: 2200, minXp: 0 },
  { id: 'bronze', name: 'Bronze', defendTimeMs: 2200, attackTimeMs: 1900, minXp: 150 },
  { id: 'silver', name: 'Silver', defendTimeMs: 1800, attackTimeMs: 1600, minXp: 400 },
  { id: 'gold', name: 'Gold', defendTimeMs: 1450, attackTimeMs: 1300, minXp: 800 },
  { id: 'diamond', name: 'Diamond', defendTimeMs: 1150, attackTimeMs: 1100, minXp: 1500 },
  { id: 'champion', name: 'Champion', defendTimeMs: 900, attackTimeMs: 950, minXp: 2600 },
];

/** Modifiers applied to the reaction window by abilities. */
export const TIME_MOD = {
  FREEZE: 0.55, // defender keeps 55% of their time
  FOCUS: 1.6, // defender gains 60% more time
};

/** Match configuration defaults. */
export const MATCH = {
  startingHp: 3,
};

/** XP economy. */
export const XP = {
  perMatch: 20, // just for showing up / completing a match
  perHitLanded: 8,
  perDodge: 4,
  perComboPeak: 6, // per extra hit in your best combo (combo 3 = +12)
  winBonus: 40,
};
