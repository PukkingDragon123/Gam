// Shadow Boxing Ultimate — app entry point and turn orchestration.
//
// Flow: menu → setup → (calibrate, camera only) → game loop → result.
// All game rules live in match.js / rules.js; this file owns flow, timing,
// input capture and wiring the UI to player decisions.

import { DIRECTIONS, ABILITY, ABILITIES, RANKS, MATCH } from './constants.js';
import {
  getProfile,
  rankForXp,
  nextRank,
  unlockedAbilities,
  unlockedArenas,
  ARENAS,
  recordMatch,
  resetProfile,
  setSelection,
} from './progression.js';
import { Match } from './match.js';
import { Ai } from './ai.js';
import { KeyboardSource, CameraSource, HeadTracker } from './input.js';
import * as ui from './ui.js';

const HUMAN = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randDir = () => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

const state = {
  profile: null,
  rank: RANKS[0],
  mode: null, // 'camera' | 'keyboard'
  ability: null, // chosen ability id
  arena: 'dojo',
  source: null, // KeyboardSource | CameraSource
  match: null,
  ai: null,
  aborted: false,
  armedAttack: false, // human armed an attack-side ability this turn
};

let captureControls = null; // live during an input-capture window

/* ============================ boot ============================ */

function boot() {
  ui.cacheDom();
  ui.renderHowAbilities();
  refreshProfile();
  wireMenu();
  wireSetup();
  wireCalibrate();
  wireGame();
  ui.show('menu');
}

function refreshProfile() {
  state.profile = getProfile();
  state.rank = rankForXp(state.profile.xp);
  ui.renderProfile(state.profile, state.rank, nextRank(state.profile.xp));
}

/* ============================ menu ============================ */

function wireMenu() {
  document.querySelector('#btn-play').addEventListener('click', openSetup);
  document.querySelector('#btn-how').addEventListener('click', () => ui.show('how'));
  document.querySelector('#btn-reset').addEventListener('click', () => {
    if (confirm('Reset all progress (XP, ranks and unlocks)?')) {
      resetProfile();
      refreshProfile();
    }
  });
  document.querySelectorAll('[data-goto]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.goto === 'setup') openSetup();
      else ui.show(b.dataset.goto);
    })
  );
}

/* ============================ setup ============================ */

function openSetup() {
  refreshProfile();
  const xp = state.profile.xp;
  const unlockedAb = unlockedAbilities(xp);
  ui.buildAbilityChoices(unlockedAb);
  ui.buildArenaChoices(ARENAS, unlockedArenas(xp), state.profile.selected.arena);

  // Sensible defaults.
  state.mode = CameraSource && HeadTracker.isSupported() ? 'camera' : 'keyboard';
  state.ability = unlockedAb[0] ?? null;
  state.arena = state.profile.selected.arena ?? 'dojo';
  ui.markSelected('#mode-row', 'mode', state.mode);
  ui.markSelected('#ability-row', 'ability', state.ability);
  ui.markSelected('#arena-row', 'arena', state.arena);
  setModeHint();
  validateStart();
  ui.show('setup');
}

function setModeHint() {
  const hint = document.querySelector('#mode-hint');
  if (state.mode === 'camera') {
    hint.textContent = HeadTracker.isSupported()
      ? 'Move your head to dodge. You will calibrate before the match.'
      : '⚠ Camera not available in this browser — use Keyboard.';
  } else {
    hint.textContent = 'Use arrow keys or W A S D. Hold a direction to lock it in.';
  }
}

function wireSetup() {
  document.querySelector('#mode-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    if (btn.dataset.mode === 'camera' && !HeadTracker.isSupported()) return;
    state.mode = btn.dataset.mode;
    ui.markSelected('#mode-row', 'mode', state.mode);
    setModeHint();
    validateStart();
  });

  document.querySelector('#ability-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ability]');
    if (!btn || btn.disabled) return;
    state.ability = btn.dataset.ability;
    ui.markSelected('#ability-row', 'ability', state.ability);
    validateStart();
  });

  document.querySelector('#arena-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-arena]');
    if (!btn || btn.disabled) return;
    state.arena = btn.dataset.arena;
    setSelection('arena', state.arena);
    ui.markSelected('#arena-row', 'arena', state.arena);
  });

  document.querySelector('#btn-start').addEventListener('click', startFromSetup);
}

function validateStart() {
  const ok = !!state.mode && !!state.ability;
  document.querySelector('#btn-start').disabled = !ok;
}

async function startFromSetup() {
  if (state.mode === 'keyboard') {
    state.source = new KeyboardSource();
    await state.source.start();
    beginMatch();
  } else {
    await enterCalibration();
  }
}

/* ============================ calibrate ============================ */

function wireCalibrate() {
  document.querySelector('#btn-calibrate').addEventListener('click', () => {
    state.source.calibrate();
    beginMatch();
  });
}

async function enterCalibration() {
  ui.show('calibrate');
  const status = document.querySelector('#calib-status');
  const btn = document.querySelector('#btn-calibrate');
  const reticle = document.querySelector('#calib-reticle');
  btn.disabled = true;
  status.textContent = 'Starting camera…';

  state.source = new CameraSource();
  try {
    await state.source.start(document.querySelector('#calib-video'));
  } catch (err) {
    status.textContent = '⚠ Could not access camera. Go back and choose Keyboard.';
    console.error(err);
    return;
  }
  status.textContent = 'Loading face tracking…';

  state.source.onFrame = (st) => {
    const left = Math.max(4, Math.min(96, 50 + st.offset.dx * 140));
    const top = Math.max(4, Math.min(96, 50 + st.offset.dy * 140));
    reticle.style.left = `${left}%`;
    reticle.style.top = `${top}%`;
    if (st.hasFace) {
      btn.disabled = false;
      status.textContent = 'Face detected — center your head, then calibrate.';
    } else {
      status.textContent = 'Looking for your face…';
    }
  };
}

/* ============================ match setup ============================ */

function beginMatch() {
  state.aborted = false;
  const xp = state.profile.xp;
  state.rank = rankForXp(xp);
  const rankIndex = RANKS.findIndex((r) => r.id === state.rank.id);
  const skill = Math.min(0.9, 0.45 + rankIndex * 0.09);
  const aiAbility = pickAiAbility();

  state.match = new Match({
    p1: { id: 'you', name: 'You', ability: state.ability },
    p2: { id: 'rival', name: aiName(), ability: aiAbility },
    defendTimeMs: state.rank.defendTimeMs,
    attackTimeMs: state.rank.attackTimeMs,
    startingHp: MATCH.startingHp,
  });
  state.ai = new Ai({ skill });

  ui.setArena(state.arena);
  ui.setCameraVisible(state.mode === 'camera');
  ui.setOpponentName(state.match.players[1].name);
  ui.renderHp(humanP(), oppP());
  ui.clearArrows();
  ui.showAim(null);
  ui.setReticleDir('center');
  ui.timerOff();
  ui.show('game');

  if (state.mode === 'camera') {
    state.source.attachDisplay(document.querySelector('#game-video'));
    state.source.onFrame = (st) => ui.setReticleOffset(st.offset);
  }

  gameLoop();
}

function pickAiAbility() {
  const ids = Object.keys(ABILITIES);
  return ids[Math.floor(Math.random() * ids.length)];
}

function aiName() {
  const names = ['Rival', 'The Phantom', 'Vega', 'Iron Maki', 'Specter', 'Razor'];
  return names[Math.floor(Math.random() * names.length)];
}

const humanP = () => state.match.players[HUMAN];
const oppP = () => state.match.players[1 - HUMAN];

/* ============================ game loop ============================ */

async function gameLoop() {
  await countdown();
  while (!state.match.isOver && !state.aborted) {
    await runTurn();
    if (state.match.isOver || state.aborted) break;
    await wait(650);
  }
  if (state.aborted) return;
  endMatch();
}

async function countdown() {
  for (const n of ['3', '2', '1', 'FIGHT']) {
    if (state.aborted) return;
    ui.setBanner(n, '');
    await wait(550);
  }
}

async function runTurn() {
  ui.setTurnMeta(state.rank.name, state.match.turnNumber + 1);
  ui.clearArrows();
  ui.showAim(null);
  const humanAttacking = state.match.attackerIndex === HUMAN;
  if (humanAttacking) await humanAttackTurn();
  else await humanDefendTurn();
}

/* ---- human attacks, AI defends ---- */
async function humanAttackTurn() {
  state.armedAttack = false;
  ui.setBanner('ATTACK', 'Aim where they WON’T be');
  ui.setActionHint(hintFor('attack'));
  setupAbilityButton('attack');
  await wait(600);
  if (state.aborted) return;

  ui.timerOn();
  const res = await captureCommit({
    timeMs: state.match.attackTimeMs,
    onTick: ({ remaining, total, dir }) => {
      ui.timerSet(remaining / total);
      if (state.mode === 'keyboard') ui.setReticleDir(dir);
      ui.showAim(dir === 'center' ? null : dir);
    },
  });
  ui.timerOff();
  if (res.aborted) return;

  const attackDir = res.dir || randDir();
  ui.showAim(attackDir);
  ui.setAbilityButton({ visible: false });

  const ctx = state.match.beginTurn({
    attackDir,
    attackerAbilities: state.armedAttack ? [state.ability] : [],
  });

  const aiDef = state.ai.decideDefense(ctx, {
    canUseAbility: oppP().abilityUses > 0,
    ability: oppP().ability,
  });
  for (const id of aiDef.abilities) state.match.useActiveDefenderAbility(id);

  ui.setBanner('ATTACK', res.dir ? '' : 'Wild swing!');
  await wait(250);
  ui.opponentLunge(aiDef.dir);

  const summary = state.match.resolveTurn(aiDef.dir);
  state.ai.observeHumanAttack(attackDir);
  await showResolution(summary, { attackerIsHuman: true });
}

/* ---- AI attacks, human defends ---- */
async function humanDefendTurn() {
  const aiAtk = state.ai.decideAttack({
    canUseAbility: oppP().abilityUses > 0,
    ability: oppP().ability,
    hp: oppP().hp,
    oppHp: humanP().hp,
  });

  const ctx = state.match.beginTurn({
    attackDir: aiAtk.dir,
    attackerAbilities: aiAtk.abilities,
  });

  ui.setBanner('DEFEND', defendSub(ctx));
  ui.setActionHint(hintFor('defend'));
  ui.clearArrows();
  ui.opponentLunge(null);
  setupAbilityButton('defend');
  await wait(600);
  if (state.aborted) return;

  // Reveal the telegraph (already distorted by blind/reverse inside ctx).
  ui.showTelegraph(ctx.indicatorDir);
  ui.timerOn(true);

  const startTime = ctx.defendTimeMs;
  const res = await captureCommit({
    timeMs: startTime,
    onTick: ({ remaining, total, dir }) => {
      ui.timerSet(remaining / total);
      if (state.mode === 'keyboard') ui.setReticleDir(dir);
    },
  });
  ui.timerOff();
  if (res.aborted) return;

  ui.setAbilityButton({ visible: false });
  const defendDir = res.dir; // may be null if they never moved
  const summary = state.match.resolveTurn(defendDir);
  state.ai.observeHumanDodge(defendDir);

  // Reveal the *true* attack so the player learns from blind/reverse turns.
  ui.showTelegraph(ctx.attackDir);
  ui.opponentLunge(ctx.attackDir);
  await showResolution(summary, { attackerIsHuman: false });
}

function defendSub(ctx) {
  if (ctx.blind) return 'BLINDED — no telegraph!';
  if (ctx.appliedAbilities.includes(ABILITY.FREEZE)) return 'FROZEN — react fast!';
  return 'Move away from the punch';
}

async function showResolution(summary, { attackerIsHuman }) {
  const youGotHit = summary.result === 'hit' && !attackerIsHuman;
  const youLandedHit = summary.result === 'hit' && attackerIsHuman;

  if (summary.result === 'hit') {
    ui.flashResult('hit', youLandedHit ? 'HIT!' : 'OUCH!');
    if (youLandedHit) ui.opponentHurt();
  } else {
    ui.flashResult('dodge', attackerIsHuman ? 'BLOCKED' : 'DODGE!');
  }
  ui.renderHp(humanP(), oppP());
  await wait(750);
  void youGotHit;
}

/* ---- ability button wiring ---- */
function setupAbilityButton(phase) {
  const def = ABILITIES[state.ability];
  const human = humanP();
  const relevant = def && def.side === phase && human.abilityUses > 0;
  if (!relevant) {
    ui.setAbilityButton({ visible: false });
    return;
  }
  ui.setAbilityButton({
    visible: true,
    enabled: true,
    label: `${def.icon} ${def.name} (${human.abilityUses})`,
  });
}

function onAbilityClick() {
  const def = ABILITIES[state.ability];
  if (!def) return;
  if (def.side === 'attack') {
    if (state.armedAttack) return;
    state.armedAttack = true;
    ui.setAbilityButton({ visible: true, enabled: false, label: `${def.icon} Armed ✓` });
  } else if (def.side === 'defend') {
    // Focus: extend the live reaction window immediately.
    const before = state.match.activeContext?.defendTimeMs ?? 0;
    const ctx = state.match.useActiveDefenderAbility(state.ability);
    if (ctx && captureControls) {
      captureControls.extend(ctx.defendTimeMs - before);
      const left = humanP().abilityUses;
      ui.setAbilityButton({
        visible: true,
        enabled: left > 0,
        label: left > 0 ? `${def.icon} ${def.name} (${left})` : `${def.icon} Used`,
      });
    }
  }
}

/* ============================ input capture ============================ */

/**
 * Resolve when the player locks a direction (held for lockMs) or the timer
 * runs out. Returns the committed direction (last non-center seen).
 * captureControls.extend(ms) lets Focus grow the window mid-flight.
 */
function captureCommit({ timeMs, lockMs = 200, onTick }) {
  return new Promise((resolve) => {
    const start = performance.now();
    let end = start + timeMs;
    let heldDir = 'center';
    let heldSince = start;
    let lastNonCenter = null;
    let raf = 0;

    const finish = (result) => {
      cancelAnimationFrame(raf);
      captureControls = null;
      resolve(result);
    };
    captureControls = {
      extend: (ms) => {
        end += ms;
      },
      cancel: () => finish({ aborted: true }),
    };

    const step = (now) => {
      if (state.aborted) return finish({ aborted: true });
      const remaining = end - now;
      const total = end - start;
      const dir = state.source.getDirection();

      if (dir && dir !== 'center') {
        lastNonCenter = dir;
        if (dir === heldDir) {
          if (now - heldSince >= lockMs) {
            if (onTick) onTick({ remaining, total, dir });
            return finish({ dir });
          }
        } else {
          heldDir = dir;
          heldSince = now;
        }
      } else {
        heldDir = 'center';
      }

      if (onTick) onTick({ remaining: Math.max(0, remaining), total, dir });
      if (remaining <= 0) return finish({ dir: lastNonCenter, timedOut: true });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
}

/* ============================ result / quit ============================ */

function wireGame() {
  document.querySelector('#ability-btn').addEventListener('click', onAbilityClick);
  document.querySelector('#btn-quit').addEventListener('click', quitMatch);
  document.querySelector('#btn-rematch').addEventListener('click', () => {
    if (state.mode === 'keyboard') {
      state.source = new KeyboardSource();
      state.source.start();
      beginMatch();
    } else {
      // Camera is still running from before — just restart the match.
      beginMatch();
    }
  });
}

function quitMatch() {
  state.aborted = true;
  if (captureControls) captureControls.cancel();
  teardownSource();
  ui.timerOff();
  refreshProfile();
  ui.show('menu');
}

function teardownSource() {
  if (state.source) {
    try {
      state.source.stop();
    } catch {
      /* ignore */
    }
  }
  state.source = null;
}

function endMatch() {
  const you = humanP();
  const won = state.match.winner === you;
  const summaryUnlocks = recordMatch({
    won,
    hitsLanded: you.hitsLanded,
    dodges: you.dodges,
  });

  // Camera can keep running for a rematch; keyboard source is recreated.
  if (state.mode === 'keyboard') teardownSource();

  refreshProfile();
  ui.renderResult({ won, you, summaryUnlocks, xpGained: summaryUnlocks.gained });
  ui.show('result');
}

/* ---- misc copy ---- */
function hintFor(phase) {
  if (phase === 'attack') {
    return state.mode === 'camera'
      ? 'Lean your head toward the direction you want to punch.'
      : 'Press a direction to punch — same direction as their dodge = HIT.';
  }
  return state.mode === 'camera'
    ? 'Move your head AWAY from the incoming punch.'
    : 'Press a direction other than the punch to dodge.';
}

boot();
