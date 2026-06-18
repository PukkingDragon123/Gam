// Pure rules for one exchange of Shadow Boxing Ultimate.
// No DOM, no timers, no randomness — trivially unit-testable.

import { RESULT, OPPOSITE, ABILITY, TIME_MOD } from './constants.js';

/**
 * Resolve a single exchange.
 *
 * The defender must actively move their head to a direction that differs from
 * the real attack direction. Failing to commit (null / 'center') counts as a
 * hit, because a motionless head is right where the punch lands.
 *
 * @param {string} attackDir  one of DIRECTIONS
 * @param {string|null} defendDir  one of DIRECTIONS, or null/'center' for no commit
 * @returns {'hit'|'dodge'}
 */
export function resolveExchange(attackDir, defendDir) {
  if (!defendDir || defendDir === 'center') return RESULT.HIT;
  return defendDir === attackDir ? RESULT.HIT : RESULT.DODGE;
}

/**
 * Build the turn context that the UI renders and the resolver consumes.
 * Abilities mutate a *copy* of this; the real attack direction is never lost.
 *
 * @param {object} args
 * @param {string} args.attackDir            the real attack direction
 * @param {number} args.defendTimeMs         base reaction window
 * @returns {{
 *   attackDir: string,
 *   indicatorDir: string|null,  // what the defender is shown (null = blind)
 *   defendTimeMs: number,
 *   blind: boolean,
 *   reversed: boolean,
 *   appliedAbilities: string[]
 * }}
 */
export function makeTurnContext({ attackDir, defendTimeMs }) {
  return {
    attackDir,
    indicatorDir: attackDir, // by default the defender sees the truth
    defendTimeMs,
    blind: false,
    reversed: false,
    appliedAbilities: [],
  };
}

/**
 * Apply one ability's effect to a turn context and return the new context.
 * Returns the same context unchanged for abilities that don't alter the turn
 * (e.g. Double Turn only affects turn order, handled by the Match).
 *
 * @param {object} ctx  turn context from makeTurnContext
 * @param {string} abilityId
 * @returns {object} new turn context
 */
export function applyAbility(ctx, abilityId) {
  const next = { ...ctx, appliedAbilities: [...ctx.appliedAbilities, abilityId] };
  switch (abilityId) {
    case ABILITY.FREEZE:
      next.defendTimeMs = Math.round(ctx.defendTimeMs * TIME_MOD.FREEZE);
      return next;
    case ABILITY.FOCUS:
      next.defendTimeMs = Math.round(ctx.defendTimeMs * TIME_MOD.FOCUS);
      return next;
    case ABILITY.REVERSE:
      // Only flips the *shown* indicator, never the real attack direction.
      next.reversed = true;
      next.indicatorDir = ctx.indicatorDir ? OPPOSITE[ctx.indicatorDir] : null;
      return next;
    case ABILITY.BLIND:
      next.blind = true;
      next.indicatorDir = null;
      return next;
    default:
      // DOUBLE and NONE don't change the turn context.
      return next;
  }
}

/**
 * @param {{hp:number}} player
 * @returns {boolean}
 */
export function isDefeated(player) {
  return player.hp <= 0;
}
