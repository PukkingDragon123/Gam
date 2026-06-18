// Match controller: owns player state, roles, turn order and ability charges.
// Pure logic — timing and rendering live in main.js / ui.js. Unit-testable.

import { MATCH, ABILITY, ABILITIES, RESULT } from './constants.js';
import { resolveExchange, makeTurnContext, applyAbility, isDefeated } from './rules.js';

/**
 * @typedef {Object} PlayerInit
 * @property {string} id
 * @property {string} name
 * @property {string} ability  ability id (may be ABILITY.NONE)
 */

let _seq = 0;

export class Match {
  /**
   * @param {object} cfg
   * @param {PlayerInit} cfg.p1
   * @param {PlayerInit} cfg.p2
   * @param {number} cfg.defendTimeMs  base reaction window for this rank
   * @param {number} [cfg.attackTimeMs]
   * @param {number} [cfg.startingHp]
   */
  constructor(cfg) {
    const hp = cfg.startingHp ?? MATCH.startingHp;
    this.defendTimeMs = cfg.defendTimeMs;
    this.attackTimeMs = cfg.attackTimeMs ?? cfg.defendTimeMs;
    this.players = [cfg.p1, cfg.p2].map((p) => ({
      id: p.id,
      name: p.name,
      hp,
      maxHp: hp,
      ability: p.ability || ABILITY.NONE,
      abilityUses: p.ability && ABILITIES[p.ability] ? ABILITIES[p.ability].uses : 0,
      hitsLanded: 0,
      dodges: 0,
      combo: 0, // current consecutive same-direction hit streak while attacking
      maxCombo: 0,
      lastHitDir: null, // direction of the most recent landed hit (for chaining)
    }));
    this.attackerIndex = 0;
    this.turnNumber = 0;
    /** Set while a turn is in flight. */
    this.activeContext = null;
    /** When true, the attacker keeps the role next turn (Double Turn). */
    this._repeatAttacker = false;
  }

  get attacker() {
    return this.players[this.attackerIndex];
  }

  get defender() {
    return this.players[1 - this.attackerIndex];
  }

  /** @returns {boolean} */
  get isOver() {
    return this.players.some(isDefeated);
  }

  /** @returns {object|null} the winning player, or null if still going. */
  get winner() {
    if (!this.isOver) return null;
    const alive = this.players.filter((p) => !isDefeated(p));
    return alive.length === 1 ? alive[0] : null;
  }

  /**
   * Begin a turn. The attacker has already (conceptually) chosen a direction;
   * pass it in. Abilities are applied here based on the explicit `use*` flags
   * so callers (human UI or AI) stay in control of when charges are spent.
   *
   * @param {object} args
   * @param {string} args.attackDir
   * @param {string[]} [args.attackerAbilities]  ability ids the attacker spends
   * @param {string[]} [args.defenderAbilities]  ability ids the defender spends
   * @returns {object} the active turn context (for rendering)
   */
  beginTurn({ attackDir, attackerAbilities = [], defenderAbilities = [] }) {
    this.turnNumber += 1;
    let ctx = makeTurnContext({ attackDir, defendTimeMs: this.defendTimeMs });

    for (const id of attackerAbilities) {
      if (this._spendCharge(this.attacker, id, 'attack')) {
        ctx = applyAbility(ctx, id);
      }
    }
    for (const id of defenderAbilities) {
      if (this._spendCharge(this.defender, id, 'defend')) {
        ctx = applyAbility(ctx, id);
      }
    }

    this._repeatAttacker = attackerAbilities.includes(ABILITY.DOUBLE);
    this.activeContext = ctx;
    return ctx;
  }

  /**
   * Resolve the in-flight turn against the defender's committed direction.
   * Updates HP / stats and advances the role order.
   *
   * @param {string|null} defendDir
   * @returns {{
   *   result: 'hit'|'dodge',
   *   attacker: object, defender: object,
   *   attackDir: string, defendDir: string|null,
   *   gameOver: boolean, winner: object|null
   * }}
   */
  resolveTurn(defendDir) {
    if (!this.activeContext) throw new Error('resolveTurn called with no active turn');
    const ctx = this.activeContext;
    const result = resolveExchange(ctx.attackDir, defendDir);

    const attacker = this.attacker;
    const defender = this.defender;

    if (result === RESULT.HIT) {
      defender.hp = Math.max(0, defender.hp - 1);
      attacker.hitsLanded += 1;
      // Combo grows only when you land the SAME direction again. Switching to a
      // fresh direction (or a first hit) starts a new chain at 1.
      attacker.combo = attacker.lastHitDir === ctx.attackDir ? attacker.combo + 1 : 1;
      attacker.lastHitDir = ctx.attackDir;
      attacker.maxCombo = Math.max(attacker.maxCombo, attacker.combo);
      defender.combo = 0;
      defender.lastHitDir = null;
    } else {
      defender.dodges += 1;
      attacker.combo = 0;
      attacker.lastHitDir = null;
    }

    // A landed hit keeps you on the attack (combo); Double Turn forces one
    // extra attack even on a miss.
    const keepAttacker = result === RESULT.HIT || this._repeatAttacker;
    this._repeatAttacker = false;

    const summary = {
      result,
      attacker,
      defender,
      attackDir: ctx.attackDir,
      defendDir: defendDir ?? null,
      combo: attacker.combo,
      comboContinues: keepAttacker && result === RESULT.HIT,
      comboRepeatDir: result === RESULT.HIT ? ctx.attackDir : null,
      gameOver: this.isOver,
      winner: this.winner,
    };

    this.activeContext = null;
    if (!this.isOver && !keepAttacker) this.attackerIndex = 1 - this.attackerIndex;
    return summary;
  }

  /**
   * Spend a defender ability mid-turn (e.g. Focus), after the telegraph is
   * already on screen. Mutates the active context and returns it, or null if
   * the charge could not be spent.
   * @param {string} abilityId
   * @returns {object|null}
   */
  useActiveDefenderAbility(abilityId) {
    if (!this.activeContext) return null;
    if (!this._spendCharge(this.defender, abilityId, 'defend')) return null;
    this.activeContext = applyAbility(this.activeContext, abilityId);
    return this.activeContext;
  }

  /** Does `playerIndex` still have a usable charge of their ability? */
  canUseAbility(playerIndex) {
    const p = this.players[playerIndex];
    return p.ability !== ABILITY.NONE && p.abilityUses > 0;
  }

  _spendCharge(player, abilityId, expectedSide) {
    if (player.ability !== abilityId) return false;
    if (player.abilityUses <= 0) return false;
    const def = ABILITIES[abilityId];
    if (def && def.side !== expectedSide) return false;
    player.abilityUses -= 1;
    return true;
  }
}
