// Headless tests for the pure game logic. Run with: node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ABILITY, ABILITIES, OPPOSITE, RESULT, TIME_MOD } from '../src/constants.js';
import {
  CHARACTERS,
  getCharacter,
  unlockedCharacters,
  randomCharacter,
} from '../src/characters.js';
import { resolveExchange, makeTurnContext, applyAbility, isDefeated } from '../src/rules.js';
import { Match } from '../src/match.js';
import { Ai } from '../src/ai.js';
import {
  xpForMatch,
  recordMatch,
  resetProfile,
  rankForXp,
  unlockedAbilities,
} from '../src/progression.js';

/* ----------------------------- rules ----------------------------- */

test('resolveExchange: same direction is a hit', () => {
  assert.equal(resolveExchange('up', 'up'), RESULT.HIT);
});

test('resolveExchange: different direction is a dodge', () => {
  assert.equal(resolveExchange('up', 'left'), RESULT.DODGE);
});

test('resolveExchange: no commit (null/center) is a hit', () => {
  assert.equal(resolveExchange('up', null), RESULT.HIT);
  assert.equal(resolveExchange('up', 'center'), RESULT.HIT);
});

test('applyAbility: freeze shrinks the window, focus grows it', () => {
  const base = makeTurnContext({ attackDir: 'up', defendTimeMs: 2000 });
  assert.equal(applyAbility(base, ABILITY.FREEZE).defendTimeMs, Math.round(2000 * TIME_MOD.FREEZE));
  assert.equal(applyAbility(base, ABILITY.FOCUS).defendTimeMs, Math.round(2000 * TIME_MOD.FOCUS));
});

test('applyAbility: reverse flips only the shown indicator', () => {
  const base = makeTurnContext({ attackDir: 'left', defendTimeMs: 2000 });
  const r = applyAbility(base, ABILITY.REVERSE);
  assert.equal(r.attackDir, 'left'); // truth preserved
  assert.equal(r.indicatorDir, OPPOSITE.left); // shown lie
  assert.equal(r.reversed, true);
});

test('applyAbility: blind hides the indicator', () => {
  const base = makeTurnContext({ attackDir: 'down', defendTimeMs: 2000 });
  const b = applyAbility(base, ABILITY.BLIND);
  assert.equal(b.indicatorDir, null);
  assert.equal(b.blind, true);
});

test('isDefeated reflects hp', () => {
  assert.equal(isDefeated({ hp: 0 }), true);
  assert.equal(isDefeated({ hp: 1 }), false);
});

/* ----------------------------- match ----------------------------- */

function freshMatch(over = {}) {
  return new Match({
    p1: { id: 'a', name: 'A', ability: ABILITY.NONE },
    p2: { id: 'b', name: 'B', ability: ABILITY.NONE },
    defendTimeMs: 2000,
    startingHp: 3,
    ...over,
  });
}

test('match: a hit damages the defender and credits the attacker', () => {
  const m = freshMatch();
  m.beginTurn({ attackDir: 'up' });
  const s = m.resolveTurn('up');
  assert.equal(s.result, RESULT.HIT);
  assert.equal(m.players[1].hp, 2);
  assert.equal(m.players[0].hitsLanded, 1);
});

test('match: a dodge deals no damage and credits the defender', () => {
  const m = freshMatch();
  m.beginTurn({ attackDir: 'up' });
  const s = m.resolveTurn('left');
  assert.equal(s.result, RESULT.DODGE);
  assert.equal(m.players[1].hp, 3);
  assert.equal(m.players[1].dodges, 1);
});

test('match: roles swap each turn by default', () => {
  const m = freshMatch();
  assert.equal(m.attackerIndex, 0);
  m.beginTurn({ attackDir: 'up' });
  m.resolveTurn('left');
  assert.equal(m.attackerIndex, 1);
});

test('match: double turn keeps the attacker and spends a charge', () => {
  const m = freshMatch({ p1: { id: 'a', name: 'A', ability: ABILITY.DOUBLE } });
  assert.equal(m.players[0].abilityUses, 1);
  m.beginTurn({ attackDir: 'up', attackerAbilities: [ABILITY.DOUBLE] });
  m.resolveTurn('left');
  assert.equal(m.attackerIndex, 0, 'attacker keeps the role');
  assert.equal(m.players[0].abilityUses, 0, 'charge spent');
});

test('match: freeze shrinks the defender window when attacking', () => {
  const m = freshMatch({ p1: { id: 'a', name: 'A', ability: ABILITY.FREEZE } });
  const ctx = m.beginTurn({ attackDir: 'up', attackerAbilities: [ABILITY.FREEZE] });
  assert.equal(ctx.defendTimeMs, Math.round(2000 * TIME_MOD.FREEZE));
  assert.equal(m.players[0].abilityUses, 1);
});

test('match: focus extends the live window for the defender', () => {
  const m = freshMatch({ p2: { id: 'b', name: 'B', ability: ABILITY.FOCUS } });
  m.beginTurn({ attackDir: 'up' }); // attacker is p1 (index 0), defender p2
  const ctx = m.useActiveDefenderAbility(ABILITY.FOCUS);
  assert.equal(ctx.defendTimeMs, Math.round(2000 * TIME_MOD.FOCUS));
  assert.equal(m.players[1].abilityUses, 1);
});

test('match: an attacker cannot spend a defender-only ability', () => {
  const m = freshMatch({ p1: { id: 'a', name: 'A', ability: ABILITY.FOCUS } });
  const ctx = m.beginTurn({ attackDir: 'up', attackerAbilities: [ABILITY.FOCUS] });
  assert.equal(ctx.defendTimeMs, 2000, 'focus ignored on attack');
  assert.equal(m.players[0].abilityUses, 2, 'no charge spent');
});

test('match: detects game over and a winner', () => {
  const m = freshMatch({ startingHp: 1 });
  m.beginTurn({ attackDir: 'up' });
  const s = m.resolveTurn('up');
  assert.equal(s.gameOver, true);
  assert.equal(m.isOver, true);
  assert.equal(m.winner, m.players[0]);
});

/* ----------------------------- ai ----------------------------- */

test('ai: a perfect defender avoids a visible telegraph', () => {
  const ai = new Ai({ skill: 1, rng: () => 0 });
  const ctx = { indicatorDir: 'right', blind: false, reversed: false, defendTimeMs: 2000 };
  const out = ai.decideDefense(ctx, { canUseAbility: false, ability: ABILITY.NONE });
  assert.notEqual(out.dir, 'right');
});

test('ai: a perfect defender sees through a reversed telegraph', () => {
  const ai = new Ai({ skill: 1, rng: () => 0 });
  // Real attack is 'left'; reverse shows 'right'.
  const ctx = { indicatorDir: 'right', blind: false, reversed: true, defendTimeMs: 2000 };
  const out = ai.decideDefense(ctx, { canUseAbility: false, ability: ABILITY.NONE });
  assert.notEqual(out.dir, 'left', 'should not walk into the real punch');
});

test('ai: a reading attacker punishes a repeated dodge', () => {
  const ai = new Ai({ skill: 1, rng: () => 0 });
  ai.humanDodges = ['left', 'left', 'left'];
  const out = ai.decideAttack({ canUseAbility: false, ability: ABILITY.NONE, hp: 3, oppHp: 3 });
  assert.equal(out.dir, 'left');
});

/* ----------------------------- progression ----------------------------- */

test('progression: xp math adds up', () => {
  assert.equal(xpForMatch({ won: true, hitsLanded: 3, dodges: 2 }), 20 + 24 + 8 + 40);
});

test('progression: recordMatch banks xp and reports new unlocks', () => {
  resetProfile();
  const summary = recordMatch({ won: true, hitsLanded: 3, dodges: 2 }); // 92 xp
  assert.equal(summary.totalXp, 92);
  assert.ok(summary.newAbilities.includes(ABILITY.FREEZE), 'freeze unlocks at 80 xp');
  resetProfile();
});

test('progression: rank and ability gating track xp', () => {
  assert.equal(rankForXp(0).id, 'rookie');
  assert.equal(rankForXp(160).id, 'bronze');
  assert.ok(!unlockedAbilities(0).includes(ABILITY.REVERSE));
  assert.ok(unlockedAbilities(300).includes(ABILITY.REVERSE));
});

test('progression: combo peak adds xp', () => {
  // 20 match + 3*8 hits + 0 dodges + (3-1)*6 combo + 0 win
  assert.equal(xpForMatch({ won: false, hitsLanded: 3, dodges: 0, maxCombo: 3 }), 56);
});

/* ----------------------------- combos ----------------------------- */

test('combo: landing a hit keeps you on the attack', () => {
  const m = freshMatch({ startingHp: 9 });
  m.beginTurn({ attackDir: 'up' });
  const s = m.resolveTurn('up');
  assert.equal(s.result, RESULT.HIT);
  assert.equal(s.comboContinues, true);
  assert.equal(m.attackerIndex, 0);
  assert.equal(m.players[0].combo, 1);
});

test('combo: grows on a repeated direction, resets on a new one', () => {
  const m = freshMatch({ startingHp: 9 });
  m.beginTurn({ attackDir: 'up' });
  m.resolveTurn('up'); // combo 1
  m.beginTurn({ attackDir: 'up' });
  const s2 = m.resolveTurn('up'); // same dir -> combo 2
  assert.equal(s2.combo, 2);
  m.beginTurn({ attackDir: 'left' });
  m.resolveTurn('left'); // new dir -> chain restarts at 1
  assert.equal(m.players[0].combo, 1);
  assert.equal(m.players[0].maxCombo, 2);
});

test('combo: a dodge breaks the chain and passes the turn', () => {
  const m = freshMatch({ startingHp: 9 });
  m.beginTurn({ attackDir: 'up' });
  m.resolveTurn('up'); // hit, still attacking
  m.beginTurn({ attackDir: 'up' });
  const s = m.resolveTurn('down'); // dodged
  assert.equal(s.result, RESULT.DODGE);
  assert.equal(m.players[0].combo, 0);
  assert.equal(m.attackerIndex, 1);
});

/* ----------------------------- characters ----------------------------- */

test('characters: every fighter maps to a real ability', () => {
  for (const c of CHARACTERS) assert.ok(ABILITIES[c.ability], `${c.name} has a valid skill`);
  assert.equal(getCharacter('dio').ability, ABILITY.FREEZE);
});

test('characters: availability follows skill unlocks', () => {
  const starter = unlockedCharacters(0);
  assert.ok(starter.includes('gojo')); // Blind — starter
  assert.ok(starter.includes('saitama')); // Focus — starter
  assert.ok(!starter.includes('dio')); // Freeze — locked at 0 xp
  assert.ok(unlockedCharacters(100).includes('dio'));
});

test('characters: randomCharacter can exclude the player pick', () => {
  for (let i = 0; i < 25; i++) {
    assert.notEqual(randomCharacter('gojo').id, 'gojo');
  }
});
