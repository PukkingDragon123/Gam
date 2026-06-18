// Rendering layer: every DOM read/write lives here so the game logic in
// main.js stays about flow, not innerHTML.

import { DIRECTIONS, ABILITIES, ABILITY } from './constants.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const SCREENS = ['menu', 'how', 'setup', 'calibrate', 'game', 'result'];
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 54; // matches r=54 in styles.css

const el = {}; // lazily-filled cache

export function cacheDom() {
  el.timerRing = $('#timer-ring');
  el.timerProg = $('#timer-prog');
  el.banner = $('#banner');
  el.bannerRole = $('#banner-role');
  el.bannerSub = $('#banner-sub');
  el.reticle = $('#reticle');
  el.opponent = $('#opponent');
  el.flash = $('#flash');
  el.stage = $('#stage');
  el.abilityBtn = $('#ability-btn');
  el.actionHint = $('#action-hint');
  el.arrows = {};
  for (const d of DIRECTIONS) el.arrows[d] = $(`.arrow.${d}`);
}

export function show(screen) {
  for (const s of SCREENS) {
    $(`#screen-${s}`).classList.toggle('is-active', s === screen);
  }
}

/* ----------------------------- menu ----------------------------- */

export function renderProfile(profile, rank, next) {
  $('#profile-rank-name').textContent = rank.name;
  const base = rank.minXp;
  const ceil = next ? next.minXp : profile.xp;
  const span = Math.max(1, ceil - base);
  const pct = next ? Math.min(100, ((profile.xp - base) / span) * 100) : 100;
  $('#xp-fill').style.width = `${pct}%`;
  $('#xp-text').textContent = next
    ? `${profile.xp} / ${next.minXp} XP`
    : `${profile.xp} XP — MAX`;
  $('#profile-stats').innerHTML =
    `<span>Matches: ${profile.matches}</span>` +
    `<span>Wins: ${profile.wins}</span>` +
    `<span>Win rate: ${profile.matches ? Math.round((profile.wins / profile.matches) * 100) : 0}%</span>`;
}

export function renderHowAbilities() {
  $('#how-abilities').innerHTML = Object.values(ABILITIES)
    .map((a) => `<li><b>${a.icon} ${a.name}</b> — ${a.blurb}</li>`)
    .join('');
}

/* ----------------------------- setup ----------------------------- */

export function buildAbilityChoices(unlockedIds) {
  const row = $('#ability-row');
  row.innerHTML = '';
  for (const a of Object.values(ABILITIES)) {
    const unlocked = unlockedIds.includes(a.id);
    const btn = document.createElement('button');
    btn.className = 'choice' + (unlocked ? '' : ' is-locked');
    btn.dataset.ability = a.id;
    btn.disabled = !unlocked;
    btn.innerHTML =
      `<span class="choice-title">${a.icon} ${a.name}` +
      (unlocked ? '' : ' <span class="lock-tag">🔒 locked</span>') +
      `</span><span class="choice-desc">${a.blurb} · ${a.uses} use${a.uses > 1 ? 's' : ''}</span>`;
    row.appendChild(btn);
  }
}

export function buildArenaChoices(arenas, unlockedIds, selectedId) {
  const row = $('#arena-row');
  row.innerHTML = '';
  for (const arena of arenas) {
    const unlocked = unlockedIds.includes(arena.id);
    const btn = document.createElement('button');
    btn.className =
      'choice' + (unlocked ? '' : ' is-locked') + (arena.id === selectedId ? ' is-selected' : '');
    btn.dataset.arena = arena.id;
    btn.disabled = !unlocked;
    btn.innerHTML =
      `<span class="choice-title">${arena.name}</span>` +
      (unlocked ? '' : `<span class="choice-desc lock-tag">🔒 unlock at ${arena.minXp} XP</span>`);
    row.appendChild(btn);
  }
}

export function markSelected(rowSel, attr, value) {
  $$(`${rowSel} .choice`).forEach((c) => {
    c.classList.toggle('is-selected', c.dataset[attr] === value);
  });
}

/* ----------------------------- game ----------------------------- */

export function setArena(id) {
  el.stage.dataset.arena = id;
}

export function setCameraVisible(visible) {
  el.stage.classList.toggle('no-cam', !visible);
}

export function renderHp(you, opp) {
  renderHearts('#hp-you', you.hp, you.maxHp);
  renderHearts('#hp-opp', opp.hp, opp.maxHp);
}

function renderHearts(sel, hp, max) {
  const node = $(sel);
  node.innerHTML = '';
  for (let i = 0; i < max; i++) {
    const h = document.createElement('div');
    h.className = 'heart' + (i < hp ? '' : ' empty');
    node.appendChild(h);
  }
}

export function setOpponentName(name) {
  $('#opp-name').textContent = name;
}

export function setTurnMeta(rankName, turn) {
  $('#rank-pill').textContent = rankName;
  $('#turn-counter').textContent = `Turn ${turn}`;
}

export function setBanner(role, sub) {
  el.bannerRole.textContent = role;
  el.bannerRole.className = 'banner-role ' + (role.toLowerCase().includes('attack') ? 'attack' : role.toLowerCase().includes('defend') ? 'defend' : '');
  el.bannerSub.textContent = sub || '';
}

export function clearArrows() {
  for (const d of DIRECTIONS) el.arrows[d].className = `arrow ${d}`;
}

export function showTelegraph(dir) {
  clearArrows();
  if (dir) el.arrows[dir].classList.add('telegraph');
}

export function showAim(dir) {
  for (const d of DIRECTIONS) el.arrows[d].classList.toggle('aim', d === dir);
}

/** Position the reticle from a normalized offset (camera) or a direction. */
export function setReticleOffset(offset) {
  const left = clamp(50 + offset.dx * 140, 6, 94);
  const top = clamp(50 + offset.dy * 140, 6, 94);
  el.reticle.style.left = `${left}%`;
  el.reticle.style.top = `${top}%`;
}

const DIR_POS = {
  center: [50, 50],
  up: [50, 12],
  down: [50, 88],
  left: [12, 50],
  right: [88, 50],
};
export function setReticleDir(dir) {
  const [l, t] = DIR_POS[dir] || DIR_POS.center;
  el.reticle.style.left = `${l}%`;
  el.reticle.style.top = `${t}%`;
}

export function timerOn(danger = false) {
  el.timerRing.classList.add('is-on');
  el.timerRing.classList.toggle('danger', danger);
  el.timerProg.style.strokeDashoffset = '0';
}
export function timerSet(fraction) {
  const f = clamp(fraction, 0, 1);
  el.timerProg.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - f));
  el.timerRing.classList.toggle('danger', f < 0.33);
}
export function timerOff() {
  el.timerRing.classList.remove('is-on', 'danger');
}

export function opponentLunge(dir) {
  el.opponent.className = 'opponent' + (dir ? ` lunge-${dir}` : '');
}
export function opponentHurt() {
  el.opponent.classList.add('hurt');
  setTimeout(() => el.opponent.classList.remove('hurt'), 320);
}

export function flashResult(kind, text) {
  el.flash.className = `flash ${kind} show`;
  el.flash.textContent = text;
  setTimeout(() => (el.flash.className = 'flash'), 700);
}

export function setAbilityButton({ visible, label, enabled }) {
  el.abilityBtn.hidden = !visible;
  if (visible) {
    el.abilityBtn.textContent = label;
    el.abilityBtn.disabled = !enabled;
  }
}

export function setActionHint(text) {
  el.actionHint.textContent = text || '';
}

/* ----------------------------- result ----------------------------- */

export function renderResult({ won, you, summaryUnlocks, xpGained }) {
  const title = $('#result-title');
  title.textContent = won ? 'VICTORY' : 'DEFEAT';
  title.className = won ? 'win' : 'lose';
  $('#result-sub').textContent = won
    ? 'You read them like a book.'
    : 'Shake it off — run it back.';
  $('#result-stats').innerHTML =
    statBlock(you.hitsLanded, 'Hits landed') +
    statBlock(you.dodges, 'Dodges') +
    statBlock(you.hp, 'HP left');
  $('#xp-gain').innerHTML = `+ <b>${xpGained}</b> XP`;

  const unlocks = [];
  if (summaryUnlocks.rankedUp) unlocks.push(`Ranked up to <b>${summaryUnlocks.rankedUp.name}</b>!`);
  for (const id of summaryUnlocks.newAbilities)
    unlocks.push(`New ability unlocked: <b>${ABILITIES[id]?.name ?? id}</b>`);
  for (const id of summaryUnlocks.newArenas) unlocks.push(`New arena unlocked: <b>${id}</b>`);
  for (const id of summaryUnlocks.newCosmetics) unlocks.push(`New cosmetic unlocked: <b>${id}</b>`);
  $('#unlocks').innerHTML = unlocks.map((u) => `<div class="unlock">🎉 ${u}</div>`).join('');
}

function statBlock(value, label) {
  return `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export { ABILITY };
