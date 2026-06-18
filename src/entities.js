// entities.js — the surfer and every spawnable object, plus an EntityManager
// that moves, recycles, animates and collision-checks them. update() returns a
// list of gameplay events for game.js to score.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { waveHeight } from './world.js';

const COLORS = {
  board: 0xffd23f,
  boardStripe: 0xff6b6b,
  wetsuit: 0x2b3a67,
  skin: 0xffcf9e,
  note: 0xffe66d,
  ring: 0x4dd7ff,
  wave: 0x16a0d8,
  banner: 0xff5d8f,
  sand: 0xffe3a3,
  palm: 0x2fbf71,
  trunk: 0x9c6b3f,
  dolphin: 0x9fb8c8,
  whale: 0x3a6dd8,
};

// ── Surfer ──────────────────────────────────────────────────────────────
export function makeSurfer() {
  const g = new THREE.Group();

  const board = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 2.2, 4, 12),
    new THREE.MeshStandardMaterial({ color: COLORS.board, roughness: 0.5, flatShading: true })
  );
  // Capsule axis is local Y → tip it forward (world Z) and flatten it into a board.
  board.rotation.x = Math.PI / 2;
  board.scale.set(1, 1, 0.32); // local Z (→ world thickness) thinned
  g.add(board);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.2, 3.0),
    new THREE.MeshStandardMaterial({ color: COLORS.boardStripe, roughness: 0.5 })
  );
  stripe.position.y = 0.16;
  g.add(stripe);

  // rider
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: COLORS.wetsuit, roughness: 0.7, flatShading: true })
  );
  torso.position.y = 0.9;
  rider.add(torso);
  const head = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.28, 1),
    new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.8, flatShading: true })
  );
  head.position.y = 1.55;
  rider.add(head);
  const armMat = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.8, flatShading: true });
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 3, 6), armMat);
    arm.position.set(s * 0.42, 1.0, 0);
    arm.rotation.z = s * 0.9;
    rider.add(arm);
  }
  g.add(rider);
  g.userData.rider = rider;
  g.userData.board = board;

  return g;
}

// ── Spawnable factories ─────────────────────────────────────────────────
function makeNote() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.note, emissive: COLORS.note, emissiveIntensity: 0.7, roughness: 0.4 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), mat);
  head.scale.set(1.2, 0.9, 1);
  g.add(head);
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), mat);
  stem.position.set(0.45, 0.7, 0);
  g.add(stem);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.06), mat);
  flag.position.set(0.66, 1.15, 0);
  g.add(flag);
  g.userData.type = 'note';
  return g;
}

function makeRing() {
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.ring, emissive: COLORS.ring, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.92 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.32, 16, 36), mat);
  ring.userData.type = 'ring';
  ring.userData.radius = 3.0;
  return ring;
}

function makeJumpObstacle() {
  // a low curling wave crest you ollie over (jump apex ≈ 2.8, so keep it low)
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.wave, roughness: 0.4, flatShading: true, transparent: true, opacity: 0.95 });
  const crest = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.6, 12, 24, Math.PI), mat);
  crest.rotation.z = Math.PI;
  crest.scale.set(2.6, 1, 1);
  g.add(crest);
  const foam = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 5, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
  foam.rotation.z = Math.PI / 2;
  foam.position.y = 0.9;
  g.add(foam);
  g.userData.type = 'jump';
  g.userData.clearance = 1.5; // metres of air above the water needed to clear
  return g;
}

function makeDuckObstacle() {
  // a low banner you crouch under (standing head ≈ 2.15, crouched ≈ 1.35)
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4, 8), postMat);
    post.position.set(s * 4, 2, 0);
    g.add(post);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 1.4, 0.2),
    new THREE.MeshStandardMaterial({ color: COLORS.banner, roughness: 0.6, emissive: COLORS.banner, emissiveIntensity: 0.2 })
  );
  banner.position.y = 2.9;
  g.add(banner);
  g.userData.type = 'duck';
  g.userData.lowEdge = 1.4; // crouched head (≈1.0) passes; standing head (≈1.8) clips
  return g;
}

function makeIsland(side) {
  const g = new THREE.Group();
  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 9, 1.4, 18),
    new THREE.MeshStandardMaterial({ color: COLORS.sand, roughness: 1, flatShading: true })
  );
  g.add(sand);
  for (let i = 0; i < 3; i++) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 4.5, 7), new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1, flatShading: true }));
    trunk.position.y = 2.6;
    trunk.rotation.z = (Math.random() - 0.5) * 0.4;
    palm.add(trunk);
    const fronds = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), new THREE.MeshStandardMaterial({ color: COLORS.palm, roughness: 1, flatShading: true }));
    fronds.position.y = 5;
    fronds.scale.set(1.4, 0.7, 1.4);
    palm.add(fronds);
    palm.position.set((Math.random() - 0.5) * 6, 0.7, (Math.random() - 0.5) * 6);
    g.add(palm);
  }
  g.userData.type = 'island';
  g.userData.side = side;
  return g;
}

function makeDolphin() {
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.dolphin, roughness: 0.5, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 2.0, 4, 8), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 6), mat);
  fin.position.set(0, 0.6, 0);
  g.add(fin);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.6, 6), mat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0, -1.4);
  g.add(tail);
  g.userData.type = 'dolphin';
  return g;
}

function makeWhale() {
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.whale, roughness: 0.6, flatShading: true });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), mat);
  body.scale.set(1.1, 0.8, 2.6);
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10), new THREE.MeshStandardMaterial({ color: 0xcfe6f2, roughness: 0.7 }));
  belly.scale.set(1.0, 0.5, 2.4);
  belly.position.y = -1.4;
  g.add(belly);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 6), mat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -9;
  tail.scale.set(1, 0.3, 1);
  g.add(tail);
  g.userData.type = 'whale';
  g.userData.clearance = 1.3; // air above water to clear its back — a normal ollie does it
  return g;
}

function makeCloudRing() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.9 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + Math.random(), 0), mat);
    puff.position.set(Math.cos(a) * 6, 6 + Math.sin(a) * 6, 0);
    g.add(puff);
  }
  g.userData.type = 'cloud';
  return g;
}

// ── Manager ───────────────────────────────────────────────────────────────
export class EntityManager {
  constructor(world) {
    this.world = world;
    this.scene = world.scene;
    this.active = [];
    this.surfer = makeSurfer();
    this.scene.add(this.surfer);
  }

  _add(obj, x, z, y = 0) {
    obj.position.set(x, y, z);
    this.scene.add(obj);
    this.active.push(obj);
    return obj;
  }

  spawnNote(x, z) {
    return this._add(makeNote(), x, z, 2.5);
  }
  spawnRing(x, z) {
    return this._add(makeRing(), x, z, 3.0);
  }
  spawnJump(x, z) {
    return this._add(makeJumpObstacle(), x, z, 0.4);
  }
  spawnDuck(x, z) {
    return this._add(makeDuckObstacle(), x, z, 0);
  }
  spawnIsland(side, z) {
    return this._add(makeIsland(side), side * (CONFIG.laneWidth + 12), z, -0.4);
  }
  spawnDolphins(z) {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const d = makeDolphin();
      d.userData.phase = i * 0.7;
      d.userData.side = i % 2 ? 1 : -1;
      out.push(this._add(d, (i % 2 ? 1 : -1) * (5 + i), z - i * 4, 0));
    }
    return out;
  }
  spawnWhale(z) {
    return this._add(makeWhale(), 0, z, -3);
  }
  spawnCloudTunnel(z) {
    const out = [];
    for (let i = 0; i < 4; i++) out.push(this._add(makeCloudRing(), 0, z - i * 22, 0));
    return out;
  }

  clear() {
    for (const o of this.active) this.scene.remove(o);
    this.active.length = 0;
  }

  // Move everything, animate, recycle, and collision-check against the surfer.
  // Returns an array of events.
  update(dt, speed, time, surferState) {
    const events = [];
    const sx = surferState.x;
    const sy = surferState.y;
    // Judge jumps/ducks by height ABOVE the local water (not absolute Y) so a
    // wave trough can never make a well-timed trick fail. waterBase mirrors the
    // surfer's grounded ride height in game.js (waveHeight + 0.35).
    const waterBase = waveHeight(sx, 0, time) + 0.35;
    const airHeight = sy - waterBase; // ~0 grounded, up to ~2.5 at jump apex
    const headAboveWater = airHeight + (surferState.crouch ? 1.0 : 1.8);

    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      o.position.z += speed * dt;
      const type = o.userData.type;
      const dz = o.position.z; // surfer is at z≈0
      const dx = o.position.x - sx;

      // ride the surface (things that float)
      if (type === 'note') {
        o.position.y = 2.4 + waveHeight(o.position.x, o.position.z, time) + Math.sin(time * 2 + dz) * 0.2;
        o.rotation.y += dt * 2;
      } else if (type === 'ring') {
        o.position.y = 3.0 + waveHeight(o.position.x, o.position.z, time);
        o.rotation.z += dt * 0.6;
      } else if (type === 'jump' || type === 'duck' || type === 'island') {
        o.position.y = (type === 'island' ? -0.4 : type === 'jump' ? 0.4 : 0) + waveHeight(o.position.x, o.position.z, time) * 0.6;
      } else if (type === 'dolphin') {
        const ph = time * 1.6 + o.userData.phase;
        o.position.y = Math.max(-0.5, Math.sin(ph) * 2.4);
        o.rotation.x = -Math.cos(ph) * 0.8; // nose follows the leap arc
        o.position.x = o.userData.side * (5 + Math.sin(time + o.userData.phase));
      } else if (type === 'whale') {
        o.position.y = -3 + waveHeight(0, o.position.z, time) + Math.max(0, Math.sin(time * 0.6)) * 1.2;
      } else if (type === 'cloud') {
        o.rotation.z += dt * 0.2;
      }

      // ── events, evaluated the moment an object passes the surfer (dz→0⁺) ──
      // Notes are collected anywhere in a small window; everything else is
      // judged at the pass. Steer aside (out of x-range) and you simply dodge.
      const passing = !o.userData.done && dz > 0;
      if (type === 'note' && !o.userData.done && dz > -2.0 && Math.abs(dx) < 2.2 && Math.abs(o.position.y - (sy + 2)) < 2.8) {
        o.userData.done = true;
        events.push({ type: 'note' });
        this._remove(i);
        continue;
      }
      if (type === 'ring' && passing) {
        o.userData.done = true;
        const through = Math.abs(dx) < o.userData.radius - 0.6 && Math.abs(o.position.y - (sy + 3)) < o.userData.radius - 0.6;
        events.push({ type: 'ring', hit: through });
        if (through) o.material.emissiveIntensity = 1.6;
      }
      if (type === 'jump' && passing) {
        o.userData.done = true;
        if (Math.abs(dx) < 3.0) events.push({ type: airHeight >= o.userData.clearance ? 'trick' : 'wipeout' });
      }
      if (type === 'duck' && passing) {
        o.userData.done = true;
        if (Math.abs(dx) < 4.0) events.push({ type: headAboveWater <= o.userData.lowEdge ? 'trick' : 'wipeout' });
      }
      if (type === 'whale' && passing) {
        o.userData.done = true;
        if (Math.abs(dx) < 5.0) events.push(airHeight >= o.userData.clearance ? { type: 'trick', big: true } : { type: 'wipeout' });
      }
      if (type === 'island' && passing) {
        o.userData.done = true;
        if (surferState.x * o.userData.side > CONFIG.laneWidth * 0.55) events.push({ type: 'island', side: o.userData.side });
      }
      if (type === 'cloud' && passing && Math.abs(dx) < 6 && sy > 3) {
        o.userData.done = true;
        events.push({ type: 'cloud' });
      }

      // recycle once well behind the camera
      if (o.position.z > CONFIG.despawnBehind) this._remove(i);
    }
    return events;
  }

  _remove(i) {
    const o = this.active[i];
    this.scene.remove(o);
    this.active.splice(i, 1);
  }
}
