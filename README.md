# 🌴 Brasilian Skies — a hand-surf tribute

A cozy, camera-controlled surfing game made as a **fan tribute** to Masayoshi
Takanaka's breezy 1978 jazz-fusion album **_Brasilian Skies_ (ブラジリアン・スカイズ)**.

Steer a little surfboard with your **bare hand** — move it to carve, raise it to
ollie over waves, lower it to duck under banners, open your palm for a speed
boost, clench a fist for a sharp turn. Ride a full day → night cycle, collect
floating music notes, thread glowing rings for combos, surf past dolphins and
breaching whales, and discover hidden islands that reveal real facts about the
album. It's relaxing, not competitive: a wipeout costs your combo, never your
run.

> No webcam? The whole game also plays on the **keyboard**.

---

## ✋ Controls

| Hand gesture | Keyboard | Action |
| --- | --- | --- |
| Move hand left / right | `←` `→` / `A` `D` | Steer the surfboard |
| Raise hand | `↑` / `W` / `Space` | Jump over waves |
| Lower hand | `↓` / `S` | Crouch under obstacles |
| Open palm | `Shift` | Speed boost |
| Closed fist | `Q` / `E` | Sharp turn (left / right) |
| — | `Esc` / `P` | Pause |

In camera mode you calibrate once: hold a hand comfortably centered, hit
**Calibrate**, and that becomes your neutral steering position. The feed is
mirrored like a real mirror, so your physical right is screen-right.

## 🌊 Gameplay

- **Beautiful, dynamic ocean** with a stylized GPU wave shader and soft sun
  glitter — the surfboard and every collectible genuinely ride the surface.
- **Collect floating music notes** for points.
- **Thread glowing rings** to build a combo multiplier (up to ×3).
- **Hidden islands** — steer toward an island as it drifts past to *discover* it
  and unlock a fan-fact card in the **Island Gallery**.
- **Day → night cycle** with shifting palettes and music: bright bossa comping by
  day, a softer pad and **bioluminescent waves** by night.
- **Special moments:** surf alongside a pod of **dolphins**, jump over a
  **giant whale**, and trigger **cloud tunnels** after a chain of clean tricks.

The soundtrack is an **original, procedurally generated** bossa-nova-flavoured
piece written for this project — it evokes the album's mood without using any
copyrighted recording.

## ▶️ Run it locally

Plain HTML / CSS / ES-modules — no build step. It must be served over
`http://localhost` (ES modules and the webcam both require a secure context;
`localhost` counts, `file://` does not).

```bash
npm start            # -> python3 -m http.server 8000
# then open http://localhost:8000
```

- **Keyboard mode** works fully offline.
- **Three.js** (the 3D engine) loads from a CDN via an import-map, and **camera
  mode** lazily loads Google's **MediaPipe HandLandmarker** from a CDN the first
  time you start the camera — so those need internet access (and, for camera
  mode, a webcam + permission). If the camera is unavailable the game says so and
  you can fall back to the keyboard.

## ✅ Tests

The pure game logic (gesture classification, scoring/combo, day-night math,
input merging, progression) runs headlessly under Node's built-in runner — no
browser required:

```bash
npm test             # -> node --test
```

## 🧩 Project structure

```
index.html           # full-screen canvas + HUD + menu/how/calibrate/gallery/pause
styles.css           # tropical, glassy UI over the live 3D ocean
src/
  config.js          # tunables, palettes, and all fan content (pure data)
  gestures.js        # MediaPipe landmarks → control intent (pure, tested)
  scoring.js         # score / combo / day-night & colour math (pure, tested)
  input.js           # merge hand-gesture + keyboard into controls (pure core, tested)
  progression.js     # discovered islands + best scores, localStorage (tested)
  hands.js           # webcam + MediaPipe HandLandmarker wrapper + smoothing
  audio.js           # procedural bossa-nova soundtrack + surf SFX (Web Audio)
  world.js           # Three.js scene: sky, ocean shader, sun, fog, stars, day/night
  entities.js        # the surfer + spawnable notes/rings/obstacles/islands/dolphins/whales
  game.js            # run controller: physics, spawn director, special moments
  ui.js              # all DOM rendering
  main.js            # app flow + render loop + camera/keyboard wiring
test/
  logic.test.js      # headless unit tests for the pure modules
```

## 🎸 About the album (and the easter eggs)

_Brasilian Skies_ is Masayoshi Takanaka's fourth studio album, released by Kitty
Records on **July 21, 1978**. Half of it was recorded in **Rio de Janeiro** and
half in California, blending jazz fusion with bossa nova and samba; a young
**Ryuichi Sakamoto** contributed string arrangements and keyboards. The hidden
islands in this game surface these facts plus bits of Takanaka lore — like his
legendary **6 kg surfboard guitar** (a real surfboard hollowed out and fitted
with a guitar inside) and his signature **rainbow Yamaha SG**.

Sources used while building the fan content:

- [Brasilian Skies — Wikipedia](https://en.wikipedia.org/wiki/Brasilian_Skies)
- [Masayoshi Takanaka — Wikipedia](https://en.wikipedia.org/wiki/Masayoshi_Takanaka)
- [The tale of Takanaka's surfboard guitar — SurferToday](https://www.surfertoday.com/surfing/the-masayoshi-takanaka-surfboard-guitar)
- [Masayoshi Takanaka on his surfboard guitar — Guitar World](https://www.guitarworld.com/artists/guitarists/masayoshi-takanaka-on-bringing-back-his-surfboard-guitar)

## ⚖️ Disclaimer

This is a non-commercial, **unofficial fan project** made out of love for the
music. It is **not affiliated with, endorsed by, or sponsored by** Masayoshi
Takanaka or his labels. All trademarks belong to their owners. The music in the
game is original; no copyrighted recordings are used.

## 📜 License

Code is MIT-licensed. The referenced album, song titles, and artist facts remain
the property of their respective owners.
