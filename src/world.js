// world.js — the Three.js stage: sky, animated stylized ocean, sun, fog, stars.
// Day/night is driven entirely by the pure palette math in scoring.js.
import * as THREE from 'three';

// Wave field shared by the GPU (vertex shader) and CPU (waveHeight) so floating
// objects ride exactly the surface you see. Keep the two in sync.
const WAVE_GLSL = /* glsl */ `
  float waveHeight(vec2 p, float t){
    float h = 0.0;
    h += sin(p.x*0.18 + t*1.10) * 0.55;
    h += sin(p.y*0.13 - t*0.90) * 0.65;
    h += sin((p.x+p.y)*0.09 + t*0.60) * 0.45;
    h += sin((p.x*0.30 - p.y*0.20) + t*1.70) * 0.22;
    return h;
  }`;

export function waveHeight(x, z, t) {
  let h = 0;
  h += Math.sin(x * 0.18 + t * 1.1) * 0.55;
  h += Math.sin(z * 0.13 - t * 0.9) * 0.65;
  h += Math.sin((x + z) * 0.09 + t * 0.6) * 0.45;
  h += Math.sin((x * 0.3 - z * 0.2) + t * 1.7) * 0.22;
  return h;
}

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.fog = new THREE.Fog(0xbff0ff, 60, 260);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
    this.camera.position.set(0, 6.5, 13);
    this.camera.lookAt(0, 1.5, -14);

    this._buildSky();
    this._buildOcean();
    this._buildStars();
    this._buildLights();
    this._buildClouds();

    this.time = 0;
    window.addEventListener('resize', () => this.resize());
  }

  _buildSky() {
    const geo = new THREE.SphereGeometry(500, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x4ec5ff) },
        uBottom: { value: new THREE.Color(0xbff0ff) },
        uSunColor: { value: new THREE.Color(0xfff6c8) },
        uSunDir: { value: new THREE.Vector3(-0.3, 0.6, -0.8) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSunColor; uniform vec3 uSunDir;
        void main(){
          float h = clamp(vDir.y*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, pow(h, 0.8));
          float sun = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 90.0);
          float glow = pow(max(dot(normalize(vDir), normalize(uSunDir)), 0.0), 6.0);
          col += uSunColor * (sun*1.4 + glow*0.25);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.scene.add(this.sky);
  }

  _buildOcean() {
    const geo = new THREE.PlaneGeometry(900, 900, 220, 220);
    geo.rotateX(-Math.PI / 2);
    this.oceanMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(0x0a86c9) },
        uShallow: { value: new THREE.Color(0x37d6e8) },
        uSun: { value: new THREE.Color(0xfff6c8) },
        uSunDir: { value: new THREE.Vector3(-0.3, 0.6, -0.8) },
        uFog: { value: new THREE.Color(0xbff0ff) },
        uFogNear: { value: 60 },
        uFogFar: { value: 260 },
        uNight: { value: 0 },
      },
      vertexShader:
        WAVE_GLSL +
        /* glsl */ `
        uniform float uTime;
        varying float vH; varying float vDist;
        void main(){
          vec3 p = position;
          float h = waveHeight(p.xz, uTime);
          p.y += h;
          vH = h;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSun; uniform vec3 uSunDir;
        uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uNight;
        varying float vH; varying float vDist;
        void main(){
          float t = clamp(vH*0.5+0.5, 0.0, 1.0);
          vec3 col = mix(uDeep, uShallow, t);
          // foam on the crests
          float foam = smoothstep(0.75, 1.0, t);
          col = mix(col, vec3(1.0), foam*0.5);
          // sun glitter
          vec3 nrm = normalize(vec3(0.0, 1.0, 0.0) + vec3(dFdx(vH), 0.0, dFdy(vH))*4.0);
          float spec = pow(max(dot(nrm, normalize(uSunDir)), 0.0), 24.0);
          col += uSun * spec * 0.6 * (1.0 - uNight);
          // bioluminescent crests at night
          col += vec3(0.1, 0.9, 0.85) * foam * uNight * 1.2;
          col += vec3(0.05, 0.4, 0.45) * uNight * t;
          float fogF = smoothstep(uFogNear, uFogFar, vDist);
          col = mix(col, uFog, fogF);
          gl_FragColor = vec4(col, 1.0);
        }`,
      extensions: { derivatives: true },
    });
    this.ocean = new THREE.Mesh(geo, this.oceanMat);
    this.ocean.position.set(0, 0, -180);
    this.scene.add(this.ocean);
  }

  _buildStars() {
    const N = 600;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(460);
      if (v.y < 20) v.y = Math.abs(v.y) + 20; // keep them up in the sky
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false });
    this.stars = new THREE.Points(geo, this.starMat);
    this.scene.add(this.stars);
  }

  _buildLights() {
    this.sun = new THREE.DirectionalLight(0xfff6c8, 1.1);
    this.sun.position.set(-60, 120, -180);
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xbff0ff, 0x0a86c9, 0.7);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.35);
    this.scene.add(this.ambient);
  }

  _buildClouds() {
    this.clouds = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const puff = new THREE.Group();
      const n = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const s = 6 + Math.random() * 7;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
        m.position.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 10);
        puff.add(m);
      }
      puff.position.set((Math.random() - 0.5) * 380, 55 + Math.random() * 60, -100 - Math.random() * 400);
      puff.userData.drift = 2 + Math.random() * 3;
      this.clouds.add(puff);
    }
    this.cloudMat = mat;
    this.scene.add(this.clouds);
  }

  // pal: result of lerpPalette(); nightF: nightFactor()
  setPalette(pal, nightF, phase) {
    const set = (c, hex) => c.setHex(hex);
    set(this.skyMat.uniforms.uTop.value, pal.sky[0]);
    set(this.skyMat.uniforms.uBottom.value, pal.sky[1]);
    set(this.skyMat.uniforms.uSunColor.value, pal.sun);
    set(this.oceanMat.uniforms.uDeep.value, pal.water[0]);
    set(this.oceanMat.uniforms.uShallow.value, pal.water[1]);
    set(this.oceanMat.uniforms.uSun.value, pal.sun);
    set(this.oceanMat.uniforms.uFog.value, pal.fog);
    this.oceanMat.uniforms.uNight.value = nightF;
    this.fog.color.setHex(pal.fog);
    set(this.sun.color, pal.sun);

    // Sun arcs across the sky with the phase: high at noon, below at night.
    const elev = Math.cos(phase * Math.PI * 2); // +1 noon, -1 midnight
    const dir = new THREE.Vector3(-0.35, elev, -0.85).normalize();
    this.sun.position.copy(dir).multiplyScalar(200);
    this.skyMat.uniforms.uSunDir.value.copy(dir);
    this.oceanMat.uniforms.uSunDir.value.copy(dir);

    const dayLight = pal.light;
    this.sun.intensity = 0.25 + Math.max(elev, 0) * 1.1 * dayLight;
    this.hemi.intensity = 0.25 + 0.55 * dayLight;
    this.ambient.intensity = 0.25 + 0.2 * dayLight;
    this.starMat.opacity = nightF;
    this.cloudMat.opacity = 0.85 * (1 - 0.5 * nightF);
    this.cloudMat.color.setHex(pal.sun).lerp(new THREE.Color(0xffffff), 0.4);
  }

  update(dt) {
    this.time += dt;
    this.oceanMat.uniforms.uTime.value = this.time;
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    // gentle cloud drift, recycling across the field
    for (const c of this.clouds.children) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 220) c.position.x = -220;
    }
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
