# 🥊 Shadow Boxing Ultimate

A competitive, camera-tracking head-movement boxing game. **Read, react, predict.**

You and your opponent trade turns. The **attacker** commits a direction; the
**defender** moves their head. **Same direction → HIT. Different → DODGE.** It's
a four-way mind game played with your face (or the arrow keys).

> This repo is a complete, playable single-player-vs-AI prototype of the design.
> The rules engine is role-agnostic so online PvP can be layered on later (see
> [Roadmap](#roadmap)).

---

## The duel

```
        ▲ UP
        │
LEFT ◀──┼──▶ RIGHT          Attacker picks a direction.
        │                   Defender moves their head.
        ▼ DOWN
                            head == punch   →  HIT   (attacker scores)
                            head != punch   →  DODGE (defender safe)
                            no movement     →  HIT   (a still head gets clipped)
```

- Players **alternate** between attacking and defending.
- When **defending**, an indicator telegraphs the incoming punch — move *away*
  from it before the timer runs out.
- When **attacking**, you're guessing where the defender will move. Punch where
  they *won't* be... by predicting where they *will* go.
- First fighter to lose all their hearts loses the match.

The whole game is the mind games on top of this: reading habits, baiting a
repeat, and bending the rules with abilities.

## Controls

| Mode | How you move |
| --- | --- |
| 📷 **Camera** | Move / lean your head **up, down, left, right**. Calibrate your neutral center first. The feed is mirrored like a real mirror, so your physical right is screen-right. |
| ⌨️ **Keyboard** | **Arrow keys** or **W A S D**. Fully offline — great for testing. |

Hold a direction briefly to *lock it in*; the turn resolves as soon as you
commit. Stay centered and you'll eat the punch.

## Special abilities

Choose **one** before the match. Each has a limited number of charges.

| Ability | Effect |
| --- | --- |
| ❄️ **Freeze** | The opponent gets less time to react to your attack. |
| 🔄 **Reverse** | The direction indicator shown to the opponent is reversed. |
| 🌑 **Blind** | Hide the indicator from the opponent for one turn. |
| ⚡ **Double Turn** | Attack twice in a row instead of passing the turn. |
| 🎯 **Focus** | Slow the turn down *for yourself* — more time to read and dodge. |

Freeze / Reverse / Blind / Double are spent while **attacking**; Focus is spent
while **defending** (and can be triggered mid-turn to buy back time).

## Progression & Ranked

- Earn **XP** every match (more for hits landed, dodges, and winning).
- **Abilities**, **arenas**, and **cosmetics** unlock as your XP climbs.
- Your **rank** rises with XP. Higher ranks **shrink the reaction window**, so
  play shifts from pure reaction toward *prediction* — exactly the intended
  skill curve.

Progress is saved locally in your browser (`localStorage`).

---

## Run it locally

The game is plain HTML/CSS/ES-modules — no build step. It must be served over
`http://localhost` (ES modules and the camera both require a secure context;
`localhost` counts, `file://` does not).

```bash
# any static server works; one that ships with Python:
npm start              # -> python3 -m http.server 8000
# then open http://localhost:8000
```

- **Keyboard mode** is fully offline.
- **Camera mode** lazily loads MediaPipe's FaceLandmarker from a CDN the first
  time you start the camera, so that mode needs internet access (and a webcam +
  camera permission). If the camera is unavailable, the game tells you and you
  can fall back to keyboard.

## Tests

Pure game logic (rules, match flow, abilities, AI decisions, progression) is
covered by Node's built-in test runner — no browser required:

```bash
npm test               # -> node --test   (21 tests)
```

The browser flow (menu → setup → match → result) was smoke-tested end-to-end
with Playwright on the keyboard path; the camera-unavailable path is handled
gracefully.

## Project structure

```
index.html            # screens: menu, how-to, setup, calibrate, game, result
styles.css            # neon arena styling + arena themes
src/
  constants.js        # directions, abilities, ranks, XP economy (pure data)
  rules.js            # one-exchange resolution + ability effects (pure)
  match.js            # match controller: HP, roles, turn order, charges (pure)
  ai.js               # opponent: reads habits, reacts to telegraphs (pure)
  progression.js      # XP / unlocks, persisted to localStorage
  tracking.js         # webcam + MediaPipe head-direction detection
  input.js            # unified direction source (camera or keyboard)
  ui.js               # all DOM rendering
  main.js             # app flow, turn loop, input capture, wiring
test/
  logic.test.js       # headless unit tests for the pure modules
```

## Design notes

- **Why vs-AI first?** The four-way prediction duel, abilities, ranks, and
  progression are all expressible against a CPU opponent that reads your habits.
  Online PvP needs matchmaking + transport and is a much larger, separable
  effort. The rules in `rules.js`/`match.js` are written role-agnostically so a
  networked opponent can drop in where the AI currently sits.
- **Head direction** is derived from the nose-tip landmark's offset from a
  calibrated center, with smoothing and a dead-zone. Coarse up/down/left/right
  is all the game needs, which keeps tracking robust across lighting and faces.
- **Fairness:** abilities only ever distort what the *defender is shown*
  (`indicatorDir`) or the *time available* — never the real attack direction
  used to resolve the hit. The AI reacts to the same distorted information a
  human would.

## Roadmap

- Online & local-hotseat PvP (the engine is already role-agnostic).
- More arenas / cosmetic glove trails wired to the existing unlock tables.
- Sound design and hit/parry juice.
- Per-rank AI personalities with distinct habits to read.

## License

MIT.
