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
  unlockedArenas,
  ARENAS,
  recordMatch,
  resetProfile,
  setSelection,
} from './progression.js';
import { CHARACTERS, getCharacter, unlockedCharacters, randomVillain } from './characters.js';
import { Match } from './match.js';
import { Ai } from './ai.js';
import { KeyboardSource, CameraSource } from './input.js';

const isCameraMode = (m) => m === 'head' || m === 'hand';
import * as ui from './ui.js';
import * as vfx from './vfx.js';

const DIR_WORD = { up: '▲ UP', down: '▼ DOWN', left: '◀ LEFT', right: '▶ RIGHT' };

const HUMAN = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const randDir = () => DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];

const state = {
  profile: null,
  rank: RANKS[0],
  mode: null, // 'head' | 'hand' | 'keyboard'
  character: null, // chosen fighter id
  ability: null, // derived from the chosen fighter
  oppChar: null, // this match's opponent fighter
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
  vfx.initVfx();
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
  const unlockedChars = unlockedCharacters(xp);
  ui.buildCharacterChoices(CHARACTERS, unlockedChars);
  ui.buildArenaChoices(ARENAS, unlockedArenas(xp), state.profile.selected.arena);

  // Sensible defaults.
  state.mode = state.mode || (CameraSource.isSupported() ? 'head' : 'keyboard');
  state.character = unlockedChars.includes(state.character) ? state.character : unlockedChars[0] ?? null;
  state.ability = state.character ? getCharacter(state.character).ability : null;
  state.arena = state.profile.selected.arena ?? 'dojo';
  ui.markSelected('#mode-row', 'mode', state.mode);
  ui.markSelected('#character-row', 'char', state.character);
  ui.markSelected('#arena-row', 'arena', state.arena);
  setModeHint();
  validateStart();
  ui.show('setup');
}

function setModeHint() {
  const hint = document.querySelector('#mode-hint');
  const camOk = CameraSource.isSupported();
  if (state.mode === 'head') {
    hint.textContent = camOk
      ? 'Move your head up / down / left / right to dodge. Calibrate first.'
      : '⚠ Camera not available in this browser — use Keyboard.';
  } else if (state.mode === 'hand') {
    hint.textContent = camOk
      ? 'Move your open hand in front of the camera to dodge. Calibrate first.'
      : '⚠ Camera not available in this browser — use Keyboard.';
  } else {
    hint.textContent = 'Use arrow keys or W A S D. Hold a direction to lock it in.';
  }
}

function wireSetup() {
  document.querySelector('#mode-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    if (isCameraMode(btn.dataset.mode) && !CameraSource.isSupported()) return;
    state.mode = btn.dataset.mode;
    ui.markSelected('#mode-row', 'mode', state.mode);
    setModeHint();
    validateStart();
  });

  document.querySelector('#character-row').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-char]');
    if (!btn || btn.disabled) return;
    state.character = btn.dataset.char;
    state.ability = getCharacter(state.character).ability;
    ui.markSelected('#character-row', 'char', state.character);
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
  const ok = !!state.mode && !!state.character;
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
  const isHand = state.mode === 'hand';
  const noun = isHand ? 'hand' : 'head';
  const status = document.querySelector('#calib-status');
  const btn = document.querySelector('#btn-calibrate');
  const reticle = document.querySelector('#calib-reticle');
  document.querySelector('#calib-instruct').textContent = isHand
    ? 'Hold your open hand up in front of the camera, comfortably centered, then calibrate. Move it to dodge.'
    : 'Face the camera, hold your head comfortably centered, then calibrate. Lean to dodge.';
  btn.disabled = true;
  status.textContent = 'Starting camera…';

  state.source = new CameraSource(state.mode);
  try {
    await state.source.start(document.querySelector('#calib-video'));
  } catch (err) {
    status.textContent = '⚠ Could not access camera. Go back and choose Keyboard.';
    console.error(err);
    return;
  }
  status.textContent = `Loading ${noun} tracking…`;

  state.source.onFrame = (st) => {
    const left = Math.max(4, Math.min(96, 50 + st.offset.dx * 140));
    const top = Math.max(4, Math.min(96, 50 + st.offset.dy * 140));
    reticle.style.left = `${left}%`;
    reticle.style.top = `${top}%`;
    if (st.tracked) {
      btn.disabled = false;
      status.textContent = `${isHand ? 'Hand' : 'Face'} detected — center your ${noun}, then calibrate.`;
    } else {
      status.textContent = `Looking for your ${noun}…`;
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

  const youChar = getCharacter(state.character);
  const oppChar = randomVillain(); // the enemy is always an anime villain
  state.oppChar = oppChar;

  state.match = new Match({
    p1: { id: 'you', name: youChar.name, ability: youChar.ability },
    p2: { id: 'rival', name: oppChar.name, ability: oppChar.ability },
    defendTimeMs: state.rank.defendTimeMs,
    attackTimeMs: state.rank.attackTimeMs,
    startingHp: MATCH.startingHp,
  });
  state.ai = new Ai({ skill });

  ui.setArena(state.arena);
  ui.setCameraVisible(isCameraMode(state.mode));
  ui.setFighters(youChar, oppChar);
  ui.updateSkills(youChar.ability, humanP().abilityUses, oppChar.ability, oppP().abilityUses);
  ui.renderHp(humanP(), oppP());
  ui.clearCombo();
  ui.clearArrows();
  ui.showAim(null);
  ui.setReticleDir('center');
  ui.timerOff();
  ui.show('game');

  if (isCameraMode(state.mode)) {
    state.source.attachDisplay(document.querySelector('#game-video'));
    state.source.onFrame = (st) => ui.setReticleOffset(st.offset);
  }

  gameLoop();
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
  for (const n of ['3', '2', '1']) {
    if (state.aborted) return;
    ui.countdownTick(n, false);
    vfx.shake(0.12);
    vfx.speedLines(0.22, '#f3c969');
    await wait(620);
  }
  if (state.aborted) return;
  ui.countdownTick('FIGHT!', true);
  vfx.flash('#7fdcff', 150, 0.45);
  vfx.impact({ kind: 'dodge', intensity: 1, text: 'はじめ!' });
  await wait(650);
  ui.countdownClear();
}

async function runTurn() {
  ui.setTurnMeta(state.rank.name, state.match.turnNumber + 1);
  ui.clearArrows();
  ui.showAim(null);
  ui.updateSkills(humanP().ability, humanP().abilityUses, oppP().ability, oppP().abilityUses);
  // Show the attacker's running combo (hidden below 2).
  const atk = state.match.attacker;
  if (atk.combo >= 2) ui.setCombo(atk.combo, atk === humanP() ? 'you' : 'opp');
  else ui.clearCombo();
  // Match point: switch on the ゴゴゴ menacing aura when someone is one hit away.
  vfx.aura(Math.min(humanP().hp, oppP().hp) <= 1);
  const humanAttacking = state.match.attackerIndex === HUMAN;
  if (humanAttacking) await humanAttackTurn();
  else await humanDefendTurn();
}

/* ---- human attacks, AI defends ---- */
async function humanAttackTurn() {
  state.armedAttack = false;
  const me = humanP();
  if (me.combo >= 1 && me.lastHitDir) {
    // Combo: chain by repeating the SAME direction — but they may read it.
    ui.setBanner('COMBO', `Repeat ${DIR_WORD[me.lastHitDir]} to chain!`);
    ui.showComboHint(me.lastHitDir);
    vfx.speedLines(0.4, '#f3c969');
  } else {
    ui.setBanner('ATTACK', 'Aim where they WON’T be');
  }
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
  vfx.shake(0.12);
  vfx.speedLines(0.3, '#46f0ff');

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
    combo: oppP().combo,
    lastHitDir: oppP().lastHitDir,
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
  vfx.shake(0.16);
  if (ctx.blind) vfx.speedLines(0.55, '#b450ff');
  else vfx.speedLines(0.4, '#ff688a');

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
  const isHit = summary.result === 'hit';
  const youLandedHit = isHit && attackerIsHuman;
  const ko = summary.gameOver;
  const combo = summary.combo;

  ui.updateSkills(humanP().ability, humanP().abilityUses, oppP().ability, oppP().abilityUses);

  if (isHit) {
    if (youLandedHit) ui.opponentHurt();
    if (ko) {
      // Finisher: big gold impact frame + long freeze, JoJo style.
      ui.flashResult('hit', youLandedHit ? 'K.O.!' : 'DOWN!');
      vfx.aura(false);
      ui.clearCombo();
      await vfx.impact({ kind: 'ko', intensity: 1.8, text: 'K.O.!!' });
    } else {
      const boost = Math.min(0.7, (combo - 1) * 0.18); // bigger frames as combos grow
      ui.flashResult('hit', youLandedHit ? (combo >= 2 ? `COMBO ×${combo}!` : 'HIT!') : 'OUCH!');
      if (summary.comboContinues && combo >= 2) ui.setCombo(combo, attackerIsHuman ? 'you' : 'opp');
      await vfx.impact({
        kind: youLandedHit ? 'hit' : 'hurt',
        intensity: (youLandedHit ? 1.15 : 1) + boost,
        text: combo >= 3 ? '連撃!!' : undefined,
      });
    }
  } else {
    // dodge (you slipped it) or block (your punch missed) — combo broken.
    ui.clearCombo();
    ui.flashResult('dodge', attackerIsHuman ? 'BLOCKED' : 'DODGE!');
    vfx.impact({ kind: attackerIsHuman ? 'miss' : 'dodge', intensity: 0.85 });
  }

  ui.renderHp(humanP(), oppP());
  await wait(ko ? 700 : 480);
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
  ui.clearCombo();
  ui.countdownClear();
  vfx.aura(false);
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
  vfx.aura(false);
  const you = humanP();
  const won = state.match.winner === you;
  const summaryUnlocks = recordMatch({
    won,
    hitsLanded: you.hitsLanded,
    dodges: you.dodges,
    maxCombo: you.maxCombo,
  });

  // Camera can keep running for a rematch; keyboard source is recreated.
  if (state.mode === 'keyboard') teardownSource();

  refreshProfile();
  ui.renderResult({ won, you, summaryUnlocks, xpGained: summaryUnlocks.gained });
  ui.show('result');
}

/* ---- misc copy ---- */
function hintFor(phase) {
  const mover = state.mode === 'hand' ? 'hand' : state.mode === 'head' ? 'head' : null;
  if (phase === 'attack') {
    return mover
      ? `Move your ${mover} toward where you want to punch.`
      : 'Press a direction to punch — same direction as their dodge = HIT.';
  }
  return mover
    ? `Move your ${mover} AWAY from the incoming punch.`
    : 'Press a direction other than the punch to dodge.';
}

boot();
