# Generated assets (Higgsfield) — drop-in guide

The character-select and arena both render from **emoji + procedural CSS** by
default, so the game is complete with no downloads. When you want real art and
motion, generate it (e.g. with [Higgsfield](https://higgsfield.ai)) and drop the
files in — the UI picks them up automatically.

> Note: the assets are **not** generated in this repo's build. Generation happens
> in your Higgsfield account; this file gives you the exact prompts and where the
> files go.

## Where files go

```
assets/
  fighters/<id>/portrait.webp   # still splash art (1:1, ~1024²)
  fighters/<id>/idle.mp4        # short looping idle (2–4 s, muted, ~720²)
  arenas/<id>.jpg               # 16:10 arena background
  intro/vs.mp4                  # optional VS intro sting
```

Fighter ids: `gojo, saitama, todoroki, itachi, naruto, genos` (heroes) and
`frieza, madara, aizen, dio, meruem, cell` (villains).

## How to enable a fighter's art

Edit `src/assets.js` and map the ids you've generated:

```js
export const ASSETS = {
  gojo:   { art: 'assets/fighters/gojo/portrait.webp', video: 'assets/fighters/gojo/idle.mp4' },
  frieza: { art: 'assets/fighters/frieza/portrait.webp' },
};
```

`video` (looping idle) takes priority over `art`; either is optional. Anything
unmapped keeps the procedural emoji portrait.

## Art direction (keep it consistent)

- Anime fighting-game **splash art**, dynamic 3/4 hero pose, dramatic rim light.
- Plate it against a **dark, near-transparent** background so the portrait's
  themed glow shows through (the UI adds a colored aura behind it).
- Per-fighter accent colour matches the in-game theme (e.g. Gojo = cyan-blue,
  DIO = gold, Aizen = violet, Genos = orange).
- Clean silhouette, crisp edges, no on-image text or logos.

## Higgsfield prompts

### Hero portraits (still, 1:1)
- **Gojo** — "anime fighting-game splash art, calm sorcerer in a dark blindfold,
  swirling cyan-blue cursed-energy aura, dynamic pose, dramatic rim light, dark
  transparent background, high detail, clean silhouette"
- **Saitama** — "anime splash art, bald hero in a relaxed unbothered stance,
  warm gold energy, confident calm expression, dramatic lighting, dark backdrop"
- **Todoroki** — "anime splash art, half-ice fighter, pale-blue frost aura,
  crystalline ice shards, sharp rim light, dark transparent background"
- **Itachi** — "anime splash art, stoic shinobi, violet genjutsu glow, swirling
  illusion motif behind, moody lighting, dark backdrop"
- **Naruto** — "anime splash art, energetic ninja mid-motion with a shadow clone
  silhouette behind, orange chakra aura, dynamic pose, dark backdrop"
- **Genos** — "anime splash art, sleek combat cyborg, glowing orange arm cannons
  charging, mechanical detail, hard rim light, dark transparent background"

### Villain portraits (still, 1:1)
- **Frieza** — "anime villain splash art, cold imperial tyrant, eerie violet
  aura, menacing smirk, dramatic lighting, dark backdrop"
- **Madara** — "anime villain splash art, armored warlord, crimson-red aura,
  ominous full-moon motif behind, heavy rim light, dark backdrop"
- **Aizen** — "anime villain splash art, calm mastermind in a white coat,
  shimmering violet illusion distortion, mirror-shard motif, dark backdrop"
- **DIO** — "anime villain splash art, blond vampire noble, radiant gold aura,
  throwing knives frozen mid-air, theatrical pose, dark backdrop"
- **Meruem** — "anime villain splash art, regal insect-king, magenta aura, calm
  overwhelming presence, ornate detail, dark backdrop"
- **Cell** — "anime villain splash art, perfect bio-android, green energy,
  relentless menacing stance, hard lighting, dark backdrop"

### Idle loops (video, 2–4 s, seamless loop)
Append to any portrait prompt: "subtle looping idle — slow breathing, aura
drifting upward, faint particle embers, camera locked, seamless loop, no text".

### Arenas (16:10 background)
- **dojo** — "neon-lit dojo at night, dark wood, paper lanterns, atmospheric"
- **rooftop** — "city rooftop at dusk, skyline bokeh, moody blue hour"
- **arena** — "grand championship arena, spotlights, dramatic haze"
- **void** — "abstract dark void with drifting energy motes, minimal"

### VS intro (optional, ~3 s)
- "fighting-game VS intro sting, two silhouettes clashing, speed lines, bold red
  accent flash, dark background, fast cut, seamless".
