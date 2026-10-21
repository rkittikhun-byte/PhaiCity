/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The kinds of power plant (โรงไฟฟ้าตามจังหวัด, docs/POWER_PLANTS.md; owner, 13 Oct 2026): the game's coal plant is
// now one of five, all on the same 4 × 4 tiles (745–760, centre 750), told apart by the map's record of what was
// built where (gameMap.powerKinds, saved with the city as powerKinds). Each brings something and costs something,
// and the province's resources (src/geo/provinceResources.ts) decide what it can build and how well it runs:
// - lignite (the old coal plant): much power, cheap to build; heavy smoke, and fuel to buy every year, cheaper where
//   the province mines lignite;
// - gas: the most power, little smoke; fuel every year, cheaper where the province has oil and gas;
// - hydro (a dam): no smoke, no fuel; dear to build, only beside a river or a lake, only in a province with
//   hydropower, and less power in the dry season;
// - solar: clean and free to run; little power for its land, and less in the rainy months; more where the sun is;
// - wind: clean; only in a province with wind, noisy (a little "pollution" that lowers the land's value), and calm
//   in the hot months.
// Pure functions, no DOM, nothing random: the simulation (src/powerManager.js) and the commands use them.

export const POWER_KINDS = ["lignite", "gas", "hydro", "solar", "wind"] as const;
export type PowerKind = typeof POWER_KINDS[number];

/** The tool that builds each kind (src/gameTools.js; the coal tool builds lignite plants, as it always did) */
export const PLANT_TOOLS: Record<PowerKind, string> = {
  lignite: "coal", gas: "gas", hydro: "hydro", solar: "solar", wind: "wind",
};

export function kindOfTool(tool: string): PowerKind | null {
  return (POWER_KINDS.find((kind) => PLANT_TOOLS[kind] === tool) ?? null);
}

/** The province's resource levels, 0–5 by id; empty for a practice map, where every kind may be built */
export type Resources = Readonly<Record<string, number>>;

/** A province's dry season (src/provinceRules.ts) */
export interface DrySeason {
  months: readonly number[];
  share: number;
}

interface Spec {
  /** Power at the given resource level (0–5) */
  power(level: number): number;
  /** The resource that powers it, or makes its fuel cheaper */
  resource: string | null;
  /** Built only where that resource is (level 1 or more) */
  needsResource: boolean;
  /** Fuel bought a year, in baht, at the given resource level */
  fuel(level: number): number;
  /** Pollution on each of its tiles (src/blockMapUtils.js); the wind farm's is its noise */
  pollution: number;
  /** Smoke rises from its chimneys (the 2D animation; the 3D view draws each kind its own way) */
  smoke: boolean;
}

const RAINY_MONTHS = [4, 5, 6, 7, 8, 9]; // May to October, 0-based
const CALM_MONTHS = [2, 3]; // March and April: the hot, still months

export const SPECS: Record<PowerKind, Spec> = {
  lignite: { power: () => 700, resource: "lignite", needsResource: false, fuel: (l) => Math.round(240 * (1 - 0.15 * l)),
    pollution: 100, smoke: true },
  gas: { power: () => 900, resource: "petroleum", needsResource: false, fuel: (l) => Math.round(360 * (1 - 0.15 * l)),
    pollution: 35, smoke: true },
  hydro: { power: (l) => 450 + 50 * l, resource: "hydro", needsResource: true, fuel: () => 0, pollution: 0, smoke: false },
  solar: { power: (l) => 220 + 30 * l, resource: "solar", needsResource: false, fuel: () => 0, pollution: 0, smoke: false },
  wind: { power: (l) => 150 + 60 * l, resource: "wind", needsResource: true, fuel: () => 0, pollution: 25, smoke: false },
};

function levelOf(kind: PowerKind, resources: Resources): number {
  const resource = SPECS[kind].resource;
  const level = resource ? resources[resource] : undefined;
  return typeof level === "number" ? Math.max(0, Math.min(5, level)) : 0;
}

/** Whether a kind may be built in this province: dams and wind farms need their resource; a practice map has all. */
export function canBuildKind(kind: PowerKind, resources: Resources): boolean {
  if (!SPECS[kind].needsResource || Object.keys(resources).length === 0) return true;
  return levelOf(kind, resources) >= 1;
}

/** A plant's power this month (0–11), before the province's own multiplier (powerPlantOutput). */
export function plantPower(kind: PowerKind, resources: Resources, month: number, dry: DrySeason | null): number {
  const level = Object.keys(resources).length === 0 ? 2 : levelOf(kind, resources);
  let power = SPECS[kind].power(level);
  if (kind === "hydro" && dry && dry.months.includes(month + 1)) power *= 1 - dry.share;
  if (kind === "solar" && RAINY_MONTHS.includes(month)) power *= 0.7;
  if (kind === "wind" && CALM_MONTHS.includes(month)) power *= 0.5;
  return Math.round(power);
}

/** What a plant's fuel costs a year, in baht, running flat out. */
export function plantFuel(kind: PowerKind, resources: Resources): number {
  return SPECS[kind].fuel(levelOf(kind, resources));
}

/** The least share of its fuel a plant burns, standing by however little of its power the city uses */
export const MIN_FUEL_SHARE = 0.2;

/**
 * The share of its fuel a plant burns when the city uses `load` (0–1) of the power its plants can give (owner, 15 Oct
 * 2026: "หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"): a plant burns for the power it makes, so a town using a third of a
 * lignite plant's power pays a third of its fuel, and a second plant built early costs little until it is needed.
 */
export function fuelShare(load: number): number {
  return Math.max(MIN_FUEL_SHARE, Math.min(1, load));
}

export function plantPollution(kind: PowerKind): number {
  return SPECS[kind].pollution;
}

export function plantSmokes(kind: PowerKind): boolean {
  return SPECS[kind].smoke;
}

/** A plant's kind as the map records it at its centre tile; a plant built before the kinds is lignite. */
export function powerKindAt(kinds: Readonly<Record<string, string>> | null | undefined, index: number): PowerKind {
  const kind = kinds?.[String(index)];
  return (POWER_KINDS as readonly string[]).includes(kind ?? "") ? kind as PowerKind : "lignite";
}

/** Whether a plant of `size` tiles (4 × 4 before src/plantBlocks.ts) centred on (x, y), the game's way (its top left at
 * x − 1, y − 1), has water beside it. */
export function besideWater(x: number, y: number, isWater: (x: number, y: number) => boolean, size = 4): boolean {
  for (let k = -1; k <= size - 2; k++) {
    if (isWater(x + k, y - 2) || isWater(x + k, y + size - 1) || isWater(x - 2, y + k) || isWater(x + size - 1, y + k)) return true;
  }
  return false;
}
