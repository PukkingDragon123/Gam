// ui.js — every DOM read/write lives here so the rest of the game stays about
// behaviour, not innerHTML.
import { ISLANDS, ALBUM } from './config.js';
import { discoveredCount } from './progression.js';

const $ = (s) => document.querySelector(s);

const SCREENS = ['menu', 'how', 'calibrate', 'gallery', 'pause'];

export function showScreen(id) {
  for (const s of SCREENS) {
    const el = $(`#screen-${s}`);
    if (el) el.classList.toggle('is-active', s === id);
  }
  $('#screens').classList.toggle('hidden', id === null);
}

export function hideScreens() {
  showScreen(null);
}

export function showHud(on) {
  $('#hud').hidden = !on;
}

export function setHud(s) {
  $('#hud-score').textContent = s.score.toLocaleString();
  $('#hud-mult').textContent = `×${s.multiplier.toFixed(2)}`;
  $('#hud-mult').classList.toggle('hot', s.multiplier >= 2);
  $('#hud-phase').textContent = s.phase;
  const meter = $('#boost-meter');
  meter.classList.toggle('ready', s.boostReady);
}

let flashTimer = null;
export function flash(text, kind = '') {
  const el = $('#flash');
  el.textContent = text;
  el.className = `flash show ${kind}`;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (el.className = 'flash'), 900);
}

let momentTimer = null;
export function moment(text) {
  const el = $('#moment');
  el.textContent = text;
  el.className = 'moment show';
  clearTimeout(momentTimer);
  momentTimer = setTimeout(() => (el.className = 'moment'), 2600);
}

export function setMenuStats(save) {
  $('#menu-best').textContent = (save.highScore || 0).toLocaleString();
  $('#menu-islands').textContent = `${discoveredCount(save)} / ${ISLANDS.length}`;
}

export function setCalibStatus(text) {
  $('#calib-status').textContent = text;
}

export function setCalibrateEnabled(on) {
  $('#btn-calibrate').disabled = !on;
}

export function renderGallery(save) {
  const grid = $('#gallery-grid');
  grid.innerHTML = '';
  for (const isl of ISLANDS) {
    const found = !!save.discovered[isl.id];
    const card = document.createElement('div');
    card.className = `gal-card ${found ? 'found' : 'locked'}`;
    if (found) {
      card.innerHTML = `
        <div class="gal-art">${isl.art}</div>
        <h4>${isl.name}</h4>
        <p class="gal-title">${isl.title}</p>
        <p class="gal-body">${isl.body}</p>`;
    } else {
      card.innerHTML = `
        <div class="gal-art">🌫️</div>
        <h4>Undiscovered island</h4>
        <p class="gal-body">Surf close to a hidden island to reveal a fan fact.</p>`;
    }
    grid.appendChild(card);
  }
  $('#gallery-sub').textContent = `${discoveredCount(save)} of ${ISLANDS.length} islands discovered.`;

  const strip = $('#album-strip');
  strip.innerHTML = `
    <h4>${ALBUM.title} <span>(${ALBUM.titleJp})</span></h4>
    <p>${ALBUM.artist} · ${ALBUM.artistJp} · ${ALBUM.released} · ${ALBUM.label}</p>
    <p class="tracks">${ALBUM.tracks.join(' · ')}</p>`;
}

export function renderPause(snapshot, save, isSummary) {
  $('#pause-title').textContent = isSummary ? 'Run paused' : 'Paused';
  $('#pause-stats').innerHTML = `
    <div><span>Score</span><strong>${snapshot.score.toLocaleString()}</strong></div>
    <div><span>Notes</span><strong>${snapshot.notes}</strong></div>
    <div><span>Best combo</span><strong>×${(save.bestMultiplier || 1).toFixed(2)}</strong></div>
    <div><span>Islands</span><strong>${discoveredCount(save)} / ${ISLANDS.length}</strong></div>`;
}

// Mirrored camera preview + landmark dots, drawn onto a single calibrate canvas.
export function drawCalibOverlay(canvas, video, landmarks) {
  const w = canvas.clientWidth || 480;
  const h = canvas.clientHeight || 360;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  if (video && video.readyState >= 2) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1); // selfie mirror
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();
  }
  if (!landmarks) return;
  ctx.fillStyle = '#ffd23f';
  for (const p of landmarks) {
    const x = (1 - p.x) * w; // mirror to match the feed
    const y = p.y * h;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Tiny mirrored cam thumbnail in the HUD so you can see tracking is alive.
export function drawCamHud(canvas, video) {
  if (!video || video.readyState < 2) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}
