// game.js — the run controller. Owns surfer physics, the procedural spawn
// director, special moments, day/night transitions, scoring and camera feel.
// It glues world + entities + audio + input + scoring together.
import { CONFIG, SCORE, MOMENTS, ISLANDS } from './config.js';
import { waveHeight } from './world.js';
import {
  createScore,
  scoreNote,
  scoreRing,
  scoreJump,
  scoreIsland,
  resetCombo,
  decayCombo,
  dayPhase,
  lerpPalette,
  nightFactor,
} from './scoring.js';
import { discoverIsland } from './progression.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor({ world, entities, audio, input, save, hooks }) {
    this.world = world;
    this.entities = entities;
    this.audio = audio;
    this.input = input;
    this.save = save;
    this.hooks = hooks || {};
    this.running = false;
  }

  start() {
    this.running = true;
    this.elapsed = 0;
    this.score = createScore();
    this.surfer = { x: 0, vx: 0, y: 0.35, vy: 0, airborne: false, crouch: false, lean: 0, boostT: 0, boostCd: 0 };
    this.speed = CONFIG.baseSpeed;
    this.shake = 0;
    this.comboTimer = CONFIG.comboWindow;
    this.trickChain = 0;
    this.prevNight = false;
    // spawn timers
    this.tNote = 0.6;
    this.tRing = 2.5;
    this.tObstacle = 2.2;
    this.tIsland = 8;
    this.tDolphin = 16;
    this.tWhale = 26;
    this.cloudCd = 0;
  }

  // Advance one frame. Returns the latest HUD snapshot.
  tick(dt) {
    if (!this.running) return this._hud();
    dt = Math.min(dt, 0.05); // clamp huge frames (tab switches)
    this.world.update(dt);
    const time = this.world.time;
    this.elapsed += dt;

    const c = this.input.sample();
    this._drive(c, dt, time);
    this._daynight();
    this._spawn(dt);

    const events = this.entities.update(dt, this.speed, time, this.surfer);
    this._handleEvents(events);

    // combo slowly decays if you stop threading rings
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) {
      decayCombo(this.score);
      this.comboTimer = CONFIG.comboWindow;
    }

    this._applyTransforms(time);
    return this._hud();
  }

  _drive(c, dt, time) {
    const s = this.surfer;

    // steering — smooth follow toward the hand's target lane
    const targetX = clamp(c.steer, -1, 1) * CONFIG.laneWidth;
    s.x += (targetX - s.x) * Math.min(1, CONFIG.steerLerp * dt);

    // sharp turn (closed fist) — a quick sideways dash
    if (c.sharpTurn !== 0) {
      s.x = clamp(s.x + c.sharpTurn * CONFIG.sharpTurnDist, -CONFIG.laneWidth, CONFIG.laneWidth);
      s.lean = c.sharpTurn * 0.6;
      this.audio.sfxJump(); // a quick whip of spray
    }
    s.x = clamp(s.x, -CONFIG.laneWidth, CONFIG.laneWidth);

    // crouch (lower hand)
    s.crouch = !!c.crouch && !s.airborne;

    // jump (raise hand)
    const ground = waveHeight(s.x, 0, time) + 0.35;
    if (c.jump && !s.airborne) {
      s.vy = CONFIG.jumpImpulse;
      s.airborne = true;
      this.audio.sfxJump();
    }
    if (s.airborne) {
      s.vy -= CONFIG.gravity * dt;
      s.y += s.vy * dt;
      if (s.y <= ground && s.vy <= 0) {
        s.y = ground;
        s.airborne = false;
        s.vy = 0;
      }
    } else {
      s.y = ground;
    }

    // boost (open palm)
    s.boostCd = Math.max(0, s.boostCd - dt);
    if (c.boost && s.boostCd <= 0) {
      s.boostT = CONFIG.boostDuration;
      s.boostCd = CONFIG.boostCooldown;
      this.audio.sfxBoost();
    }
    s.boostT = Math.max(0, s.boostT - dt);
    const targetSpeed = s.boostT > 0 ? CONFIG.boostSpeed : CONFIG.baseSpeed;
    this.speed += (targetSpeed - this.speed) * Math.min(1, 4 * dt);

    // lean settles back toward the steer direction
    const leanTarget = clamp(c.steer, -1, 1) * 0.5;
    s.lean += (leanTarget - s.lean) * Math.min(1, 8 * dt);
  }

  _daynight() {
    const phase = dayPhase(this.elapsed, CONFIG.dayLength);
    const pal = lerpPalette(phase);
    const nf = nightFactor(phase);
    this.world.setPalette(pal, nf, phase);
    this.audio.setNight(nf);
    this.phaseName = pal.name;

    const isNight = nf > 0.5;
    if (isNight !== this.prevNight) {
      this.prevNight = isNight;
      this._moment(isNight ? MOMENTS.night : MOMENTS.day);
      if (isNight) this._moment(MOMENTS.biolume);
    }
  }

  _spawn(dt) {
    const Z = -CONFIG.spawnAhead;
    const rx = () => (Math.random() * 2 - 1) * CONFIG.laneWidth * 0.85;

    this.tNote -= dt;
    if (this.tNote <= 0) {
      this.tNote = 0.45 + Math.random() * 0.5;
      this.entities.spawnNote(rx(), Z);
    }

    this.tRing -= dt;
    if (this.tRing <= 0) {
      this.tRing = 2.6 + Math.random() * 1.8;
      const x = rx();
      this.entities.spawnRing(x, Z);
      // a little trail of notes leading into the ring
      for (let i = 1; i <= 3; i++) this.entities.spawnNote(x, Z + i * 7);
    }

    this.tObstacle -= dt;
    if (this.tObstacle <= 0) {
      this.tObstacle = 2.0 + Math.random() * 1.6;
      const x = rx() * 0.7;
      if (Math.random() < 0.5) this.entities.spawnJump(x, Z);
      else this.entities.spawnDuck(0, Z);
    }

    this.tIsland -= dt;
    if (this.tIsland <= 0) {
      this.tIsland = 14 + Math.random() * 10;
      this.entities.spawnIsland(Math.random() < 0.5 ? -1 : 1, Z);
    }

    this.tDolphin -= dt;
    if (this.tDolphin <= 0) {
      this.tDolphin = 18 + Math.random() * 10;
      this.entities.spawnDolphins(Z * 0.4);
      this._moment(MOMENTS.dolphins);
    }

    this.tWhale -= dt;
    if (this.tWhale <= 0) {
      this.tWhale = 28 + Math.random() * 14;
      this.entities.spawnWhale(Z);
      this._moment(MOMENTS.whale);
    }

    this.cloudCd = Math.max(0, this.cloudCd - dt);
  }

  _handleEvents(events) {
    for (const e of events) {
      if (e.type === 'note') {
        scoreNote(this.score);
        this.audio.sfxNote();
      } else if (e.type === 'ring') {
        if (e.hit) {
          scoreRing(this.score);
          this.comboTimer = CONFIG.comboWindow;
          this.audio.sfxRing(this.score.rings);
          this.hooks.flash && this.hooks.flash(`COMBO ×${this.score.multiplier.toFixed(2)}`, 'combo');
        }
      } else if (e.type === 'trick') {
        scoreJump(this.score);
        this.trickChain += 1;
        if (e.big) this.hooks.flash && this.hooks.flash('WHALE AIR! 🐋', 'trick');
        if (this.trickChain >= 3 && this.cloudCd <= 0) {
          this.trickChain = 0;
          this.cloudCd = 18;
          this.entities.spawnCloudTunnel(-CONFIG.spawnAhead * 0.5);
          this._moment(MOMENTS.cloudTunnel);
        }
      } else if (e.type === 'cloud') {
        scoreJump(this.score);
        this.hooks.flash && this.hooks.flash('✨', 'trick');
      } else if (e.type === 'wipeout') {
        resetCombo(this.score);
        this.trickChain = 0;
        this.shake = 1;
        this.speed *= 0.55;
        this.audio.sfxWipeout();
        this.hooks.flash && this.hooks.flash('Wipeout!', 'wipeout');
      } else if (e.type === 'island') {
        const island = this._nextIsland();
        scoreIsland(this.score);
        this.audio.sfxDiscover();
        const isNew = discoverIsland(this.save, island.id);
        this.hooks.onDiscover && this.hooks.onDiscover(island, isNew);
      }
    }
  }

  // Reveal islands in order so each discovery feels like unlocking a new card.
  _nextIsland() {
    const undiscovered = ISLANDS.find((i) => !this.save.discovered[i.id]);
    return undiscovered || ISLANDS[Math.floor(Math.random() * ISLANDS.length)];
  }

  _moment(text) {
    this.hooks.moment && this.hooks.moment(text);
  }

  _applyTransforms(time) {
    const s = this.surfer;
    const g = this.entities.surfer;
    g.position.set(s.x, s.y, 0);
    g.rotation.z = -s.lean; // roll into turns
    g.rotation.x = s.airborne ? clamp(-s.vy * 0.03, -0.5, 0.5) : 0;
    const rider = g.userData.rider;
    if (rider) rider.scale.y = s.crouch ? 0.5 : 1;
    g.userData.board.material.emissiveIntensity = s.boostT > 0 ? 0.6 : 0;
    if (s.boostT > 0) g.userData.board.material.emissive?.setHex(0xfff6c8);

    // camera eases toward the surfer with a touch of wipeout shake
    const cam = this.world.camera;
    const shakeX = (Math.random() - 0.5) * this.shake * 1.4;
    const shakeY = (Math.random() - 0.5) * this.shake * 1.0;
    cam.position.x += (s.x * 0.4 + shakeX - cam.position.x) * 0.08;
    cam.position.y += (6.5 + s.y * 0.3 + shakeY - cam.position.y) * 0.1;
    cam.lookAt(s.x * 0.3, 1.6 + s.y * 0.4, -14);
    this.shake *= 0.88;
  }

  _hud() {
    return {
      score: Math.round(this.score.score),
      multiplier: this.score.multiplier,
      rings: this.score.rings,
      notes: this.score.notes,
      phase: this.phaseName || 'Noon',
      speed: this.speed,
      boostReady: this.surfer ? this.surfer.boostCd <= 0 : true,
    };
  }

  stop() {
    this.running = false;
  }
}
