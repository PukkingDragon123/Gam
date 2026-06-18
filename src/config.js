// config.js — pure data & tunables. Safe to import in Node (no browser globals).

// ───────────────────────── Gameplay tuning ─────────────────────────
export const CONFIG = {
  laneWidth: 18, // how far left/right the surfer can roam (world units, +/-)
  baseSpeed: 26, // forward units per second at cruising
  boostSpeed: 46, // forward speed while a boost is active
  steerLerp: 6, // how snappily the board follows your hand (higher = snappier)
  jumpImpulse: 13, // upward velocity of an ollie
  gravity: 34, // downward accel while airborne
  crouchDuration: 0.55, // seconds a crouch lasts
  sharpTurnDist: 7, // sideways dash distance of a fist "sharp turn"
  boostDuration: 1.6, // seconds a palm boost lasts
  boostCooldown: 2.4, // seconds before another boost can fire
  comboWindow: 4.5, // seconds before an unfed combo decays one step
  dayLength: 75, // seconds for a full day→night→day cycle
  spawnAhead: 220, // how far ahead (z) we spawn things
  despawnBehind: 30, // how far behind the surfer before recycling
};

// Score values
export const SCORE = {
  note: 100,
  ring: 250, // passing cleanly through a glowing ring
  islandDiscovery: 1000,
  trickPerJump: 50, // points for landing a jump
  comboStep: 0.25, // each ring adds this to the multiplier
  maxCombo: 8,
};

// ───────────────────────── Day / night palettes ─────────────────────────
// t in [0,1): 0 = bright noon, 0.5 = sunset, ~0.75 = deep night, →1 = dawn.
// Colors are stylized, tropical, and a little dreamy.
export const PALETTES = [
  { at: 0.0, name: 'Noon', sky: [0x4ec5ff, 0xbff0ff], water: [0x0a86c9, 0x37d6e8], sun: 0xfff6c8, fog: 0xbff0ff, light: 1.15 },
  { at: 0.28, name: 'Golden Hour', sky: [0xff9e5e, 0xffd98a], water: [0x1f7fbf, 0xffb36b], sun: 0xffd27a, fog: 0xffd6a0, light: 1.0 },
  { at: 0.46, name: 'Brasilian Sunset', sky: [0xff5d73, 0xffb15c], water: [0x6a2c8f, 0xff7a59], sun: 0xff7e6b, fog: 0xff9d7a, light: 0.85 },
  { at: 0.62, name: 'Dusk', sky: [0x3a2c74, 0xb15c8f], water: [0x1b2370, 0x6a3c9f], sun: 0xffb0a0, fog: 0x5a3c7a, light: 0.55 },
  { at: 0.78, name: 'Bioluminescent Night', sky: [0x070b2a, 0x102b54], water: [0x041634, 0x10e0c8], sun: 0x9fe8ff, fog: 0x0a1838, light: 0.32 },
  { at: 0.92, name: 'Dawn', sky: [0x2a3a74, 0x8fd0ff], water: [0x125a9f, 0x7fd0e8], sun: 0xfff0c8, fog: 0x9fd0e8, light: 0.8 },
  { at: 1.0, name: 'Noon', sky: [0x4ec5ff, 0xbff0ff], water: [0x0a86c9, 0x37d6e8], sun: 0xfff6c8, fog: 0xbff0ff, light: 1.15 },
];

// ───────────────────────── Fan content ─────────────────────────
// Real facts about the album & artist, surfaced when you discover hidden islands.
// A loving tribute — see README for sources.
export const ALBUM = {
  title: 'Brasilian Skies',
  titleJp: 'ブラジリアン・スカイズ',
  artist: 'Masayoshi Takanaka',
  artistJp: '高中正義',
  year: 1978,
  released: 'July 21, 1978',
  label: 'Kitty Records',
  tracks: [
    'Beleza Pula',
    'Brasilian Skies',
    'Nights',
    'I Remember Clifford',
    'Star Wars Samba',
    'Disco "B"',
    'Funky Holo Holo Bird',
    '伊豆甘夏納豆売り',
  ],
};

// Hidden-island cards. Each is "discovered" by surfing near its island.
// `art` is a small emoji/ASCII motif rendered in the gallery — purely decorative.
export const ISLANDS = [
  {
    id: 'rio',
    name: 'Ilha do Rio',
    art: '🌅🏖️🎸',
    title: 'Recorded under Brazilian skies',
    body:
      'Half of the album was tracked in Rio de Janeiro in 1978, the other half in California. ' +
      'Takanaka soaked up bossa nova and samba on the trip — you can hear Rio in every bar.',
  },
  {
    id: 'surfboard',
    name: 'Surfboard Cove',
    art: '🏄🎸🌊',
    title: 'The 6kg surfboard guitar',
    body:
      'Takanaka famously plays a real surfboard hollowed out and fitted with a guitar inside — ' +
      'about 6 kilograms of pure summer. This whole game is basically a love letter to that idea.',
  },
  {
    id: 'rainbow',
    name: 'Rainbow Reef',
    art: '🌈🎶✨',
    title: 'The rainbow SG',
    body:
      'His other signature is a rainbow-finished Yamaha SG. Bright, tropical, joyful — the same ' +
      'palette this little ocean borrows for its noon skies.',
  },
  {
    id: 'sakamoto',
    name: 'Strings Atoll',
    art: '🎻🎹🌴',
    title: 'A young Ryuichi Sakamoto',
    body:
      'Ryuichi Sakamoto arranged strings and played keys on Brasilian Skies, years before YMO and ' +
      'his film-score fame. Listen for the lush pads behind the guitar.',
  },
  {
    id: 'titletrack',
    name: 'Skyline Key',
    art: '🎸☁️🐬',
    title: 'The title track',
    body:
      '"Brasilian Skies" the song is breezy fusion built for an open horizon. Ranked among the best ' +
      'albums of 1978, it became a cornerstone of the city-pop sound the world rediscovered decades later.',
  },
  {
    id: 'tracklist',
    name: 'Vinyl Island',
    art: '💿🎼🍊',
    title: 'Side A to Side B',
    body:
      'Eight tracks, ~47 minutes: Beleza Pula · Brasilian Skies · Nights · I Remember Clifford · ' +
      'Star Wars Samba · Disco "B" · Funky Holo Holo Bird · 伊豆甘夏納豆売り.',
  },
];

// Little messages that flash for "special moments".
export const MOMENTS = {
  dolphins: 'Dolphins joined you! 🐬',
  whale: 'A giant whale breached — air time! 🐋',
  biolume: 'Bioluminescent waves at night… ✨',
  cloudTunnel: 'Cloud tunnel! Big trick! ☁️',
  night: 'Night falls — the music softens 🌙',
  day: 'A new day breaks ☀️',
};
