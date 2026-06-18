// Computer opponent. Pure-ish: all randomness flows through an injected rng so
// behaviour can be tested deterministically. The AI reads the human's habits —
// repeated directions get punished, exactly like a real read.

import { DIRECTIONS, OPPOSITE, ABILITY, ABILITIES } from './constants.js';

const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];

/** Predict the next entry of a direction history with recency weighting. */
function predict(history, rng) {
  if (history.length === 0) return pick(DIRECTIONS, rng);
  const weights = Object.fromEntries(DIRECTIONS.map((d) => [d, 0.001]));
  history.forEach((dir, i) => {
    // More recent moves weigh more.
    weights[dir] += 1 + i / history.length;
  });
  // Streak bonus: humans love repeating; lean into punishing it.
  const last = history[history.length - 1];
  const streak = countTrailing(history, last);
  if (streak >= 2) weights[last] += streak;

  let best = DIRECTIONS[0];
  for (const d of DIRECTIONS) if (weights[d] > weights[best]) best = d;
  return best;
}

function countTrailing(arr, value) {
  let n = 0;
  for (let i = arr.length - 1; i >= 0 && arr[i] === value; i--) n++;
  return n;
}

export class Ai {
  /**
   * @param {object} opts
   * @param {number} opts.skill   0..1 — read accuracy & trick resistance
   * @param {() => number} [opts.rng]
   */
  constructor({ skill = 0.6, rng = Math.random } = {}) {
    this.skill = skill;
    this.rng = rng;
    this.humanAttacks = []; // directions the human punched
    this.humanDodges = []; // directions the human dodged toward
  }

  observeHumanAttack(dir) {
    if (dir) this.humanAttacks.push(dir);
    if (this.humanAttacks.length > 12) this.humanAttacks.shift();
  }

  observeHumanDodge(dir) {
    if (dir) this.humanDodges.push(dir);
    if (this.humanDodges.length > 12) this.humanDodges.shift();
  }

  /**
   * AI is attacking. Predict where the human will dodge and punch there.
   * @param {{ canUseAbility: boolean, ability: string, hp: number, oppHp: number }} info
   * @returns {{ dir: string, abilities: string[] }}
   */
  decideAttack(info) {
    // Mid-combo, the AI tends to repeat its last hit to grow the chain — which
    // makes it readable. The human can dodge the repeat to break the combo.
    const repeating = info.lastHitDir && this.rng() < 0.7 - this.skill * 0.15;
    const predictedDodge = predict(this.humanDodges, this.rng);
    const onRead = this.rng() < this.skill;
    const dir = repeating
      ? info.lastHitDir
      : onRead
        ? predictedDodge
        : pick(DIRECTIONS, this.rng);

    const abilities = [];
    if (info.canUseAbility) {
      const def = ABILITIES[info.ability];
      if (def && def.side === 'attack') {
        // Use offensive abilities when a read is on, or to close out a match.
        const finisher = info.oppHp === 1;
        const wantUse = onRead || finisher || this.rng() < 0.3 * this.skill;
        if (wantUse) abilities.push(info.ability);
      }
    }
    return { dir, abilities };
  }

  /**
   * AI is defending. It reacts to what it is *shown* (which may be blinded or
   * reversed) and must move to a direction other than the real attack.
   * @param {object} ctx  turn context from the Match (indicatorDir/blind/reversed/defendTimeMs)
   * @param {{ canUseAbility: boolean, ability: string }} info
   * @returns {{ dir: string, abilities: string[] }}
   */
  decideDefense(ctx, info) {
    const abilities = [];
    let effectiveSkill = this.skill;

    // Focus: spend it when the window is tight to buy back accuracy.
    if (info.canUseAbility && ABILITIES[info.ability]?.side === 'defend') {
      if (ctx.defendTimeMs < 1500 && this.rng() < 0.7) {
        abilities.push(info.ability);
        effectiveSkill = Math.min(1, effectiveSkill + 0.2);
      }
    }

    let avoid;
    if (ctx.blind || ctx.indicatorDir == null) {
      // No indicator: guess the human's attack from habit and dodge away.
      avoid = predict(this.humanAttacks, this.rng);
    } else if (ctx.reversed) {
      // Shown a reversed arrow. A skilled AI sees through it.
      avoid = this.rng() < effectiveSkill ? OPPOSITE[ctx.indicatorDir] : ctx.indicatorDir;
    } else {
      avoid = this.rng() < effectiveSkill ? ctx.indicatorDir : pick(DIRECTIONS, this.rng);
    }

    const options = DIRECTIONS.filter((d) => d !== avoid);
    return { dir: pick(options, this.rng), abilities };
  }
}
