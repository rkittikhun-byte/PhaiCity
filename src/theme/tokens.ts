/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// PhaiCity's one theme (owner, 18 Oct 2026; docs/STYLE_GUIDE.md). Every colour, light and size that the game's pages
// and its 3D use is chosen here, taken from the concept art in assets/concept/ (eras 1-3) and the review in
// assets/review/3d-recommendation.md. css/theme.css is generated from this file (`npm run theme:css`); test/theme.ts
// checks the two agree, and that no stylesheet or model brings a colour of its own.
//
// This file imports nothing, so `node scripts/theme/build-css.mjs` can read it directly.

/** A family of one hue from light (0) to dark (950). Pages use these steps through css/theme.css. */
export const RAMPS = {
  /** Warm neutral: paper, sand, ink. The concept's background sand is 200-300, its ink outline near 800. */
  sand: { 0: 0xfffbf3, 50: 0xfbf5ea, 100: 0xf6efe4, 200: 0xeee3d0, 300: 0xdfcdb0, 400: 0xc7b08f, 500: 0xa08a6e,
    600: 0x7c6853, 700: 0x5b4a3a, 800: 0x3b2a1e, 900: 0x26190f, 950: 0x150d07 },
  /** Terracotta, the concept's clay roof tiles: the accent for what is chosen or can be pressed. */
  clay: { 50: 0xfdf1ea, 100: 0xfadfcf, 200: 0xf3c0a3, 300: 0xe99d76, 400: 0xdd8257, 500: 0xc8643f, 600: 0xa84e31,
    700: 0x853c26, 800: 0x5e2a1b, 900: 0x3a1a10 },
  /** Thatch and late-afternoon light: highlights, the start screen's gold. */
  gold: { 50: 0xfff8e8, 100: 0xfef0d0, 200: 0xfde3ae, 300: 0xfcd691, 400: 0xf0be6c, 500: 0xe3ac5b, 600: 0xc99550,
    700: 0x9c6e33, 800: 0x6b4a1f, 900: 0x3a2810 },
  /** Rice paddies and banana leaves: good news, growth. */
  rice: { 50: 0xf1f8e9, 100: 0xe1f0d0, 200: 0xc6e3a8, 300: 0xa4d27f, 400: 0x81c25b, 500: 0x5fa04a, 600: 0x4b843b,
    700: 0x3a672e, 800: 0x294a21, 900: 0x182c14 },
  /** The concept's sage river water: maps, water, information. */
  water: { 50: 0xf0f5f3, 100: 0xdfeae5, 200: 0xbfd3ca, 300: 0x9ab1a2, 400: 0x7c9b92, 500: 0x5f857e, 600: 0x4b6c67,
    700: 0x3a5350, 800: 0x283a38, 900: 0x172221 },
  /** The concept's lavender shadows: every drop shadow, settings. */
  lavender: { 50: 0xf3f2f9, 100: 0xe6e5f2, 200: 0xc9c8e3, 300: 0xa7a8cf, 400: 0x8b8cb8, 500: 0x72739d, 600: 0x5e5e86,
    700: 0x4a496c, 800: 0x34304a, 900: 0x201d2e },
  /** Chilli red: danger, disasters, cancel. */
  chili: { 50: 0xfdf0ed, 100: 0xf9dcd5, 200: 0xf2b9aa, 300: 0xeb9a87, 400: 0xdc6e57, 500: 0xc8432e, 600: 0xa33522,
    700: 0x7c2819, 800: 0x561c12, 900: 0x33100a },
} as const;

export type RampName = keyof typeof RAMPS;

/** What each colour is for on the pages: `ramp.step`, or `ramp.step/alpha`. Prefer these names to raw steps. */
export const UI_COLOURS = {
  paper: 'sand.100', paperHi: 'sand.0', glass: 'sand.0/0.8', glassStrong: 'sand.0/0.94', glassEdge: 'sand.0/0.7',
  ink: 'sand.800', inkDim: 'sand.600', line: 'sand.300',
  accent: 'clay.500', accentStrong: 'clay.600', accentSoft: 'clay.500/0.16', onAccent: 'sand.0',
  gold: 'gold.300', goldDeep: 'gold.600', success: 'rice.600', danger: 'chili.500', info: 'water.600',
  settings: 'lavender.600', night: 'sand.950', nightInk: 'sand.50', shadow: 'lavender.900/0.26',
} as const;

/** Type, corners, depth and spacing of the pages (the game HUD is small, about 9 px, and never bold). */
export const UI = {
  font: { body: "Sarabun, 'Sarabun Thai', system-ui, sans-serif", display: "'Chunk', 'Sarabun Thai', serif" },
  size: { hud: 9, small: 11, body: 13, title: 16, hero: 34 },
  radius: { chip: 6, button: 8, card: 12, pill: 999 },
  blur: { glass: 14 },
  gap: { hud: 12 },
  shadow: { card: '0 10px 28px', lift: '0 4px 14px' },
  motion: { quick: 160, normal: 260 },
} as const;

/**
 * The 3D look the concept asks for (assets/review/3d-recommendation.md, step 4). Proposed, not yet read by
 * src/render3d: until the renderer adopts it, models keep their material library colours, but new work aims here.
 */
/**
 * The building sites a plot's building goes up as (src/render3d/models/plot/site.ts): the poles and frames of bamboo and
 * timber in the old eras, the slab and steel of the later ones, and the rubble of a vacant building (tileModels.ts).
 */
export const SITE = {
  pole: { bamboo: 0xc2a35a, timber: 0x7e5634 }, frame: { bamboo: 0xa98552, timber: 0x8a5a33, steel: 0xb2aea4 },
  slab: { old: 0x9c7a4f, concrete: 0xbab6ad }, concrete: 0xa9a59c, concreteDark: 0x9e9b93, steel: 0x5c6466, steelPole: 0x6e7577,
  stack: { bamboo: 0xc9b06a, timber: 0x8a5a33 }, rubble: 0x8a7f6a,
} as const;

export const SCENE = {
  adopted: false,
  /** Each concept colour on its sunlit and its shaded side (assets/review/palette_proposal.png). */
  palette: {
    sky: { lit: 0xe9c999, shade: 0xfcd691 }, castShadow: { lit: 0x72739d, shade: 0x766f90 },
    outline: { lit: 0x3b1e10, shade: 0x391301 }, thatch: { lit: 0xe3ac5b, shade: 0xa8794a },
    teak: { lit: 0x845438, shade: 0x553021 }, clayTile: { lit: 0xd87a47, shade: 0xa9583a },
    awning: { lit: 0xe16d41, shade: 0xb44f3a }, laterite: { lit: 0xd1874c, shade: 0x835749 },
    soilCut: { lit: 0xd78846, shade: 0x7f544b }, rice: { lit: 0x81d059, shade: 0x5fa04a },
    grass: { lit: 0xa59630, shade: 0x7a6e2e }, leaf: { lit: 0xa8b930, shade: 0x5b7131 },
    water: { lit: 0x9ab1a2, shade: 0x7f9b97 }, plaster: { lit: 0xf7e5a9, shade: 0xcdb799 },
    asphalt: { lit: 0x64514a, shade: 0x4b434d }, concrete: { lit: 0xb9ae9e, shade: 0x817d8f },
  },
  /** The material library's keys (src/render3d/materials/library.ts) in the concept's colours. */
  materials: {
    plaster_white: 0xf4e8c8, plaster_cream: 0xf7e5a9, concrete_raw: 0xcdb799, concrete_weathered: 0xb9ae9e,
    brick_red: 0xc8643f, roof_clay_tile: 0xd87a47, roof_cement_tile: 0xb0806a, roof_metal_corrugated: 0xc9bba6,
    roof_metal_rusty: 0xa9583a, roof_metal_sheet: 0x8e8a9a, roof_glazed_tile: 0x5f8f86, roof_wood_shingle: 0x845438,
    thatch_grass: 0xe3ac5b, thatch_nipa: 0xc99550, bamboo_split: 0xd9b26a, bamboo_woven: 0xd2aa62,
    stucco_ornament: 0xf4e8c8, wood_teak: 0x845438, wood_painted: 0x9c7a5a, glass_clear: 0x9ab1c2,
    glass_tinted: 0x6e7f9a, asphalt: 0x64514a, sidewalk_tile: 0xcfc3ae, grass: 0xa59630, dirt_laterite: 0xd1874c,
    gravel_ballast: 0x9e8c7a, water_river: 0x9ab1a2, foliage_tropical: 0xa8b930, fabric_canvas: 0xe16d41,
  },
  /** Clothes and skin of the people (assets/concept/people_era*_v3.jpg). */
  people: { indigo: 0x4a4c84, saffron: 0xe17a1f, redBlouse: 0xcf5c47, schoolNavy: 0x4a496c, skin: 0xf2a866,
    hair: 0x2a2220 },
  /**
   * Lit side = colour x (sun + ambient) ~ colour; shaded side = colour x ambient, which the lavender ambient turns
   * mauve as in the concept. The sun comes from the right of the default view, a little toward the camera, 46° up
   * (heading 0 looks toward -z). Intensities are three.js units with physically correct lights.
   */
  light: { sun: 0xd8cf40, sunIntensity: Math.PI, sunDirection: [0.67, 0.72, 0.21], ambient: 0x99a3ff,
    ambientIntensity: Math.PI, toneMapping: 'none', shadowMapSize: 2048 },
  /** Three bands of light (shade, half, lit) for MeshToonMaterial's gradient map. */
  toonRamp: [70, 150, 255],
  outline: { colour: 0x3b1e10, strength: 0.92 },
  /** Haze and sky: warm sand, never the old pale blue. */
  sky: { haze: 0xe9c999, zenith: 0xf6d9a4, horizon: 0xfcd691 },
  /**
   * The weather (src/weather.ts, src/render3d/city/weather.ts): what the clear day's sky, haze and light turn to, by
   * how much cloud, rain, fog and smoke there is. Clouds and storms go the way of the shadows, lavender, never cold grey;
   * fog and smoke the way of the sand. Read by the renderer now, before the rest of SCENE is adopted.
   */
  weather: {
    /** Fair-weather clouds, and the clouds and haze of an overcast day */
    cloud: RAMPS.sand[50], overcastSky: RAMPS.lavender[300], overcastHaze: RAMPS.lavender[200],
    /** A storm's sky and haze */
    stormSky: RAMPS.lavender[700], stormHaze: RAMPS.lavender[500],
    /** Morning fog, and the smoke of burning fields */
    fog: RAMPS.sand[100], smoke: RAMPS.sand[400],
    /** The streaks of rain, and a flash of lightning */
    rain: RAMPS.water[100], flash: RAMPS.gold[50],
  },
  /**
   * The smoke of chimneys (src/render3d/city/plumes.ts; docs/3d/RENDERER_SPEC.md 8D): a thin plume is pale, a thick one
   * from heavy industry has soot in it; the light of the hour tints it, warm at dusk and a dim lavender by night.
   */
  plume: { day: RAMPS.sand[100], dusk: RAMPS.clay[300], night: RAMPS.lavender[700], soot: RAMPS.sand[700] },
  /**
   * The diorama lens over the city (src/render3d/city/postFx.ts): contact shadows that go the concept's lavender, never
   * black; the glow of lamps, windows and lanterns by night and of the low sun; the sun itself in the sky (sky.ts); and
   * a darker lavender edge round the picture. Read by the renderer now, before the rest of SCENE is adopted.
   */
  post: {
    /** What a corner in contact shadow turns to: the concept's cast shadow */
    contactShadow: RAMPS.lavender[500],
    /** The glow by day (glints off water and glass), at sunrise and sunset, and of the night's lamps and windows */
    glowDay: RAMPS.sand[0], glowTwilight: RAMPS.gold[300], glowNight: RAMPS.gold[200],
    /** The sun in the sky, high and low */
    sunHigh: RAMPS.gold[50], sunLow: RAMPS.clay[300],
    /** The moon in the sky and the moonlight it casts on the city at night (src/render3d/city/skyLight.ts): cool lavender
     * with the sand's warmth in the disc, never a cold blue */
    moonDisc: RAMPS.sand[50], moonLight: RAMPS.lavender[200],
    /** The picture's darker edge */
    vignette: RAMPS.lavender[800],
  },
  /**
   * The festivals (src/festivals.ts, src/render3d/city/festivals3d.ts): paper lanterns and flags along the roads near the
   * ruler's house, krathong on the water, Yi Peng's sky lanterns and Bun Bang Fai's rockets. Warm thatch-and-clay light,
   * never neon. Read by the renderer now.
   */
  festival: {
    /** Paper lanterns, lit at night (New Year, Loy Krathong, Yi Peng) */
    lanterns: [RAMPS.clay[400], RAMPS.gold[300], RAMPS.chili[400], RAMPS.gold[100]],
    /** Yi Peng's sky lanterns as they rise */
    skyLantern: RAMPS.gold[200],
    /** A krathong's banana-leaf float, and its candle */
    krathong: RAMPS.rice[600], candle: RAMPS.gold[100],
    /** Songkran's flags: water and white */
    songkran: [RAMPS.water[300], RAMPS.sand[0], RAMPS.water[500]],
    /** Bun Bang Fai's bright flags, and its rockets' smoke and flame */
    rocketFlags: [RAMPS.chili[400], RAMPS.gold[400], RAMPS.rice[400], RAMPS.clay[500]],
    smoke: RAMPS.sand[100], flame: RAMPS.gold[300],
    /** The silk festival's banners, in silk's colours */
    silk: [RAMPS.lavender[400], RAMPS.clay[500], RAMPS.gold[500], RAMPS.chili[500]],
    /** The vegetarian festival's yellow flags */
    vegetarian: [RAMPS.gold[300], RAMPS.gold[400]],
    /** The bamboo poles the bunting is strung between, and its cord */
    pole: RAMPS.gold[700], cord: RAMPS.sand[700],
  },
  /**
   * The farm zone (src/farmZone.ts, src/render3d/city/farmFields.ts; docs/GAME_DESIGN.md section 7): its paint, the
   * concept's olive between the homes' green and the factories' gold, and the paddies, fields, orchards and ponds that
   * grow on it. Read by the renderer now.
   */
  farm: {
    /** The paint on the ground and the brush */
    zone: 0xa59630,
    /** A paddy's water when planted, its young rice, the ripe rice before the harvest and the stubble after */
    paddyWater: RAMPS.water[300], paddyYoung: RAMPS.rice[400], paddyRipe: RAMPS.gold[400], stubble: RAMPS.gold[600],
    /** The dikes between paddies, and the bare earth of a field */
    dike: 0xa8794a, earth: 0xb86a40,
    /** A crop field's rows, an orchard's trees, a pond's water */
    crop: RAMPS.rice[500], orchard: RAMPS.rice[700], pond: 0x7f9b97,
    /** Huts and granaries of thatch and teak; the machines' paint; solar panels */
    thatch: 0xe3ac5b, teak: 0x845438, machine: RAMPS.chili[500], solar: RAMPS.lavender[700],
    /** A buffalo */
    buffalo: RAMPS.sand[700],
  },
} as const;

// --- css/theme.css --------------------------------------------------------------------------------------------------

const hex = (value: number): string => `#${value.toString(16).padStart(6, '0')}`;
const triplet = (value: number): string => `${value >> 16 & 255}, ${value >> 8 & 255}, ${value & 255}`;

/** A `ramp.step` or `ramp.step/alpha` reference as CSS, through the ramp's variables. */
export function cssColour(reference: string): string {
  const [name, alpha] = reference.split('/');
  const [ramp, step] = name.split('.');
  const steps = (RAMPS as Record<string, Record<string, number>>)[ramp];
  if (!steps || steps[step] === undefined) throw new Error(`No theme colour ${reference}`);
  return alpha === undefined ? `var(--ph-${ramp}-${step})` : `rgba(var(--ph-${ramp}-${step}-rgb), ${alpha})`;
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** The whole of css/theme.css. */
export function themeCss(): string {
  const lines = [
    '/* PhaiCity theme, generated from src/theme/tokens.ts by `npm run theme:css`. Do not edit by hand:',
    ' * change the tokens and run the script (docs/STYLE_GUIDE.md). */',
    ':root {',
  ];
  for (const [ramp, steps] of Object.entries(RAMPS)) {
    for (const [step, value] of Object.entries(steps)) {
      lines.push(`  --ph-${ramp}-${step}: ${hex(value)}; --ph-${ramp}-${step}-rgb: ${triplet(value)};`);
    }
  }
  for (const [name, reference] of Object.entries(UI_COLOURS)) lines.push(`  --ph-${kebab(name)}: ${cssColour(reference)};`);
  lines.push(`  --ph-font-body: ${UI.font.body};`, `  --ph-font-display: ${UI.font.display};`);
  for (const [name, px] of Object.entries(UI.size)) lines.push(`  --ph-size-${name}: ${px}px;`);
  for (const [name, px] of Object.entries(UI.radius)) lines.push(`  --ph-radius-${name}: ${px}px;`);
  lines.push(`  --ph-blur-glass: ${UI.blur.glass}px;`, `  --ph-gap-hud: ${UI.gap.hud}px;`);
  lines.push(`  --ph-shadow-card: ${UI.shadow.card} var(--ph-shadow);`, `  --ph-shadow-lift: ${UI.shadow.lift} var(--ph-shadow);`);
  for (const [name, ms] of Object.entries(UI.motion)) lines.push(`  --ph-motion-${name}: ${ms}ms;`);
  lines.push('}', '');
  return lines.join('\n');
}
