// main.js — app entry point. Owns flow (menu → calibrate → surf), the render
// loop, the camera/keyboard input wiring, and persistence. Game rules live in
// game.js; this file is about flow and wiring.
import * as THREE from 'three';
import { World } from './world.js';
import { EntityManager } from './entities.js';
import { GameAudio } from './audio.js';
import { createInput } from './input.js';
import { HandTracker } from './hands.js';
import { Game } from './game.js';
import { dayPhase, lerpPalette, nightFactor } from './scoring.js';
import * as progression from './progression.js';
import * as ui from './ui.js';

const canvas = document.getElementById('scene');
const world = new World(canvas);
const entities = new EntityManager(world);
const audio = new GameAudio();
const input = createInput();
let tracker = null;

const save = progression.load();

const game = new Game({
  world,
  entities,
  audio,
  input,
  save,
  hooks: {
    flash: (t, kind) => ui.flash(t, kind),
    moment: (t) => ui.moment(t),
    onDiscover: (island, isNew) => {
      if (isNew) {
        ui.flash('NEW ISLAND', 'island');
        ui.moment(`Discovered ${island.name}! ${island.art}`);
        progression.save(save);
      } else {
        ui.moment(`${island.name} ${island.art}`);
      }
    },
  },
});

const app = { mode: 'keyboard', running: false, paused: false, calibrating: false, menuClock: 30 };
const camHud = document.getElementById('cam-hud');
const calibOverlay = document.getElementById('calib-overlay');
const camVideo = document.getElementById('cam');

input.attach(window);
ui.setMenuStats(save);
ui.showScreen('menu');

// ───────────────────────── flow ─────────────────────────
async function ensureAudio() {
  try {
    await audio.start();
  } catch {
    /* no audio context — game still runs silently */
  }
}

async function goCalibrate() {
  ui.showScreen('calibrate');
  ui.setCalibStatus('Starting camera…');
  ui.setCalibrateEnabled(false);
  app.calibrating = true;
  tracker = new HandTracker();
  try {
    await tracker.start(camVideo);
    ui.setCalibStatus('Show one hand, centered. Then calibrate.');
  } catch (err) {
    ui.setCalibStatus('Camera unavailable — go back and try keyboard instead. (' + (err && err.name ? err.name : 'error') + ')');
    tracker = null;
  }
}

function calibrateAndPlay() {
  if (!tracker) return;
  if (!tracker.calibrate()) {
    ui.setCalibStatus('No hand detected yet — hold your hand up and try again.');
    return;
  }
  startRun('camera');
}

async function startRun(mode) {
  await ensureAudio();
  app.mode = mode;
  app.calibrating = false;
  app.paused = false;
  if (mode === 'keyboard' && tracker) {
    tracker.stop();
    tracker = null;
  }
  camHud.style.display = mode === 'camera' ? 'block' : 'none';
  entities.clear();
  game.start();
  app.running = true;
  ui.hideScreens();
  ui.showHud(true);
}

function pauseRun() {
  if (!app.running || app.paused) return;
  app.paused = true;
  ui.renderPause(game._hud(), save, true);
  ui.showScreen('pause');
}

function resumeRun() {
  app.paused = false;
  ui.hideScreens();
}

function endRun(toMenu) {
  if (app.running) {
    progression.recordRun(save, game.score.score, game.score.bestMultiplier);
    progression.save(save);
  }
  app.running = false;
  app.paused = false;
  game.stop();
  ui.showHud(false);
  if (toMenu) {
    if (tracker) {
      tracker.stop();
      tracker = null;
    }
    ui.setMenuStats(save);
    ui.showScreen('menu');
  }
}

// ───────────────────────── buttons ─────────────────────────
document.getElementById('btn-play-cam').addEventListener('click', goCalibrate);
document.getElementById('btn-play-keys').addEventListener('click', () => startRun('keyboard'));
document.getElementById('btn-how').addEventListener('click', () => ui.showScreen('how'));
document.getElementById('btn-gallery').addEventListener('click', () => {
  ui.renderGallery(save);
  ui.showScreen('gallery');
});
document.getElementById('btn-calibrate').addEventListener('click', calibrateAndPlay);
document.getElementById('btn-pause').addEventListener('click', pauseRun);
document.getElementById('btn-resume').addEventListener('click', resumeRun);
document.getElementById('btn-restart').addEventListener('click', () => {
  entities.clear();
  game.start();
  app.paused = false;
  ui.hideScreens();
});
document.getElementById('btn-quit').addEventListener('click', () => endRun(true));

for (const el of document.querySelectorAll('[data-goto]')) {
  el.addEventListener('click', () => {
    const dest = el.getAttribute('data-goto');
    if (dest === 'menu' && app.calibrating && tracker) {
      tracker.stop();
      tracker = null;
      app.calibrating = false;
    }
    ui.setMenuStats(save);
    ui.showScreen(dest);
  });
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (app.running && !app.paused) pauseRun();
    else if (app.running && app.paused) resumeRun();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.running && !app.paused) pauseRun();
});

// ───────────────────────── render loop ─────────────────────────
let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  // feed the tracker (camera mode / calibration)
  if (tracker && tracker.ready) {
    const intent = tracker.update();
    input.setHand(intent);
    if (app.calibrating) {
      ui.drawCalibOverlay(calibOverlay, camVideo, tracker.lastLandmarks);
      ui.setCalibrateEnabled(!!tracker.lastLandmarks);
      if (tracker.lastLandmarks) ui.setCalibStatus('Hand detected — calibrate when ready ✋');
    } else if (app.running && app.mode === 'camera') {
      ui.drawCamHud(camHud, camVideo);
    }
  }

  if (app.running && !app.paused) {
    const hud = game.tick(dt);
    ui.setHud(hud);
  } else {
    // idle ambiance: keep the ocean alive behind the menus, slow day/night
    world.update(dt);
    app.menuClock += dt;
    const phase = dayPhase(app.menuClock, 90);
    world.setPalette(lerpPalette(phase), nightFactor(phase), phase);
  }

  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
