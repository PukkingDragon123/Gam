// VFX engine — the "juice". Manga impact frames, speed lines, smoke, sparks,
// screen shake (trauma-based, with decay), hit-stop freeze frames, chromatic
// flashes and ゴゴゴ menacing auras. JoJo / Baki energy on a <canvas> overlay
// plus a few DOM flourishes.

let canvas, ctx;
let W = 0, H = 0, dpr = 1;
let raf = 0;
let last = 0;

let trauma = 0; // 0..1 — screen-shake energy, decays every frame
let speedT = 0; // 0..1 — manga speed-line intensity, decays
let speedColor = '#ffffff';
const particles = [];

let shakeRoot, stageEl, onoLayer, auraEl, flashEl;
let reduced = false;

const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

export function initVfx() {
  canvas = document.getElementById('vfx-canvas');
  ctx = canvas.getContext('2d');
  shakeRoot = document.getElementById('shake-root');
  stageEl = document.getElementById('stage');
  onoLayer = document.getElementById('onomatopoeia');
  auraEl = document.getElementById('aura');
  flashEl = document.getElementById('fx-flash');
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  resize();
  window.addEventListener('resize', resize);
  last = performance.now();
  loop(last);
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Center of the arena in viewport coordinates (where impacts land). */
function stageCenter() {
  if (!stageEl) return { x: W / 2, y: H / 2 };
  const r = stageEl.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height * 0.44 };
}

/* ----------------------------- main loop ----------------------------- */

function loop(now) {
  raf = requestAnimationFrame(loop);
  const dt = Math.min(48, now - last) / 16.6667; // frames elapsed (~1 at 60fps)
  last = now;

  ctx.clearRect(0, 0, W, H);

  if (speedT > 0.01) {
    drawSpeedLines(speedT);
    speedT *= Math.pow(0.86, dt);
  } else speedT = 0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update(dt);
    if (p.dead) particles.splice(i, 1);
    else p.draw(ctx);
  }

  // Trauma-based shake: offset and rotation scale with trauma², so small hits
  // barely nudge and big ones really kick.
  if (shakeRoot) {
    if (trauma > 0.002) {
      const amt = reduced ? trauma * trauma * 0.4 : trauma * trauma;
      const dx = rand(-1, 1) * 22 * amt;
      const dy = rand(-1, 1) * 22 * amt;
      const rot = rand(-1, 1) * 2.4 * amt;
      shakeRoot.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
      trauma *= Math.pow(0.9, dt);
    } else if (trauma !== 0) {
      trauma = 0;
      shakeRoot.style.transform = '';
    }
  }
}

/* ----------------------------- public API ----------------------------- */

export function shake(amount) {
  trauma = Math.min(1, trauma + amount);
}

export function speedLines(intensity = 0.8, color = '#ffffff') {
  speedT = Math.max(speedT, intensity);
  speedColor = color;
}

export function flash(color = '#ffffff', ms = 120, alpha = 0.85) {
  if (!flashEl) return;
  flashEl.style.background = color;
  flashEl.style.opacity = String(reduced ? alpha * 0.4 : alpha);
  flashEl.style.transition = 'none';
  // next frame: fade out
  requestAnimationFrame(() => {
    flashEl.style.transition = `opacity ${ms}ms ease-out`;
    flashEl.style.opacity = '0';
  });
}

export function smoke(opts = {}) {
  const c = opts.at || stageCenter();
  const n = opts.count ?? 7;
  for (let i = 0; i < n; i++) {
    particles.push(new Smoke(c.x + rand(-30, 30), c.y + rand(-20, 20), opts));
  }
}

export function sparks(opts = {}) {
  const c = opts.at || stageCenter();
  const n = opts.count ?? 16;
  const color = opts.color || '#fff2a8';
  for (let i = 0; i < n; i++) {
    particles.push(new Spark(c.x, c.y, color));
  }
}

export function aura(on) {
  if (auraEl) auraEl.classList.toggle('on', !!on);
}

/** Hit-stop: freeze the action briefly. Resolves after `ms`. */
export function hitStop(ms = 90) {
  if (stageEl) {
    stageEl.classList.add('hitstop');
    setTimeout(() => stageEl.classList.remove('hitstop'), ms);
  }
  return new Promise((r) => setTimeout(r, reduced ? ms * 0.5 : ms));
}

const ONOMA = {
  hit: ['ドンッ!', 'ドゴォ!!', 'バキィ!', 'ズガァン!', 'ゴッ!'],
  hurt: ['グハッ!', 'ガッ!!', 'ぐぅっ', 'ドサッ'],
  dodge: ['ヒュンッ', 'スゥッ', 'かわした!', 'ザッ'],
  miss: ['スカッ', '空ぶり', 'チィッ', 'ふっ'],
  ko: ['K.O.!!'],
  fight: ['ファイト!'],
};

/**
 * Full manga impact frame. Awaitable — resolves after the hit-stop so the
 * caller can keep the action frozen for the perfect beat.
 */
export function impact({ kind = 'hit', intensity = 1, text } = {}) {
  const c = stageCenter();
  const palette = {
    hit: { flash: '#ffffff', line: '#ffffff', spark: '#fff2a8', poly: '#ffffff', stroke: '#1a1030' },
    hurt: { flash: '#ff2a52', line: '#ff688a', spark: '#ff9bb0', poly: '#ffd2dc', stroke: '#5a0010' },
    dodge: { flash: '#7af6ff', line: '#7af6ff', spark: '#bff8ff', poly: '#d8feff', stroke: '#063a44' },
    miss: { flash: '#9aa0c7', line: '#c7cdf0', spark: '#dfe4ff', poly: '#ffffff', stroke: '#222' },
    ko: { flash: '#ffffff', line: '#ffd86b', spark: '#ffe9a8', poly: '#ffffff', stroke: '#3a2400' },
  }[kind] || {};

  const frozen = kind === 'hit' || kind === 'hurt' || kind === 'ko';

  flash(palette.flash, frozen ? 150 : 90, kind === 'ko' ? 0.95 : 0.8);
  speedLines(Math.min(1, 0.6 * intensity + (frozen ? 0.3 : 0)), palette.line);
  shake(frozen ? 0.55 * intensity : 0.28 * intensity);
  if (frozen) mangaPanel(120 * intensity);

  particles.push(new ImpactBurst(c.x, c.y, intensity, palette));
  if (frozen || kind === 'ko') {
    sparks({ at: c, color: palette.spark, count: Math.round(18 * intensity) });
    smoke({ at: c, count: Math.round(6 * intensity) });
  } else if (kind === 'dodge' || kind === 'miss') {
    smoke({ at: c, count: 4, drift: kind === 'dodge' ? 1 : 0 });
  }

  const label = text || pick(ONOMA[kind] || ONOMA.hit);
  burstText(label, kind, intensity);

  return frozen || kind === 'ko' ? hitStop((kind === 'ko' ? 220 : 90) * Math.min(1.4, intensity)) : Promise.resolve();
}

/* ----------------------------- DOM flourishes ----------------------------- */

function mangaPanel(ms) {
  if (!stageEl || reduced) return;
  stageEl.classList.add('manga');
  setTimeout(() => stageEl.classList.remove('manga'), ms);
}

function burstText(text, kind, intensity) {
  if (!onoLayer) return;
  const el = document.createElement('div');
  el.className = `onoma onoma-${kind}`;
  el.textContent = text;
  const c = stageCenter();
  el.style.left = `${c.x + rand(-40, 40)}px`;
  el.style.top = `${c.y + rand(-50, 10)}px`;
  el.style.setProperty('--rot', `${rand(-12, 12)}deg`);
  el.style.setProperty('--scale', String(0.9 + 0.5 * Math.min(1.4, intensity)));
  onoLayer.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

/* ----------------------------- particles ----------------------------- */

const pick = (a) => a[Math.floor(Math.random() * a.length)];

class Smoke {
  constructor(x, y, opts) {
    this.x = x;
    this.y = y;
    this.r = rand(14, 30);
    this.vr = rand(0.6, 1.4);
    this.vx = rand(-0.6, 0.6);
    this.vy = (opts.drift ? rand(-2.4, -1.2) : rand(-1.2, -0.3));
    this.life = 1;
    this.decay = rand(0.012, 0.024);
    this.hue = opts.dark ? 30 : 230;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.r += this.vr * dt;
    this.life -= this.decay * dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(c) {
    const a = Math.max(0, this.life) * 0.5;
    const g = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r);
    g.addColorStop(0, `hsla(${this.hue}, 30%, 88%, ${a})`);
    g.addColorStop(1, `hsla(${this.hue}, 30%, 80%, 0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(this.x, this.y, this.r, 0, TAU);
    c.fill();
  }
}

class Spark {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = rand(0, TAU);
    const sp = rand(4, 13);
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.size = rand(2, 5);
    this.life = 1;
    this.decay = rand(0.03, 0.06);
    this.color = color;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 0.35 * dt; // gravity
    this.vx *= Math.pow(0.92, dt);
    this.life -= this.decay * dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(c) {
    c.globalAlpha = Math.max(0, this.life);
    c.fillStyle = this.color;
    // square sparks for a pixel-art bite
    const s = this.size;
    c.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    c.globalAlpha = 1;
  }
}

class ImpactBurst {
  constructor(x, y, intensity, palette) {
    this.x = x;
    this.y = y;
    this.t = 0;
    this.dur = 18;
    this.spikes = Math.round(rand(9, 13));
    this.maxR = (reduced ? 110 : 170) * intensity;
    this.rot = rand(0, TAU);
    this.fill = palette.poly || '#fff';
    this.stroke = palette.stroke || '#000';
    this.dead = false;
  }
  update(dt) {
    this.t += dt;
    if (this.t >= this.dur) this.dead = true;
  }
  draw(c) {
    const k = this.t / this.dur; // 0..1
    const ease = 1 - Math.pow(1 - k, 3);
    const rOuter = this.maxR * ease;
    const rInner = rOuter * (0.42 + 0.1 * Math.sin(this.t));
    const alpha = 1 - k;
    c.save();
    c.translate(this.x, this.y);
    c.rotate(this.rot + k * 0.5);
    c.globalAlpha = alpha;
    c.beginPath();
    for (let i = 0; i < this.spikes * 2; i++) {
      const r = i % 2 === 0 ? rOuter : rInner;
      const ang = (i / (this.spikes * 2)) * TAU;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = this.fill;
    c.fill();
    c.lineWidth = 5;
    c.strokeStyle = this.stroke;
    c.stroke();
    // hollow center so it reads as a "POW" burst
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(0, 0, rInner * 0.7, 0, TAU);
    c.fill();
    c.restore();
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}

function drawSpeedLines(intensity) {
  const c = stageCenter();
  const count = reduced ? 24 : 64;
  const inner = Math.max(W, H) * 0.18;
  const outer = Math.max(W, H) * 0.95;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = Math.min(0.9, intensity);
  ctx.strokeStyle = speedColor;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * TAU + (i % 2 ? 0.02 : -0.02);
    const wobble = rand(0.9, 1.1);
    ctx.lineWidth = rand(1, 5) * intensity;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * inner * wobble, Math.sin(ang) * inner * wobble);
    ctx.lineTo(Math.cos(ang) * outer, Math.sin(ang) * outer);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
