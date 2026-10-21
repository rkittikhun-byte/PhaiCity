/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Turns what happens in a running game into sound. It only listens: simulation messages, tool results,
// sprite and bulldozer sound signals, and the tiles currently on screen. It never changes game state.

import type { CityView, TileRect } from "../cityView";
import * as Messages from "../messages";
import type { PlayOptions } from "./engine";
import { BELL_VOLUME, TempleBells, templeInView } from "./templeBells.js";

export interface SoundPlayer {
  play(id: string, options?: PlayOptions): void;
  setLoop(id: string, level: number): void;
}

export type MessageGroup = "good" | "bad" | "neutral" | null;

// Sounds for specific simulation messages; other messages get the notification sound of their group.
const MESSAGE_SOUNDS: Record<string, string[]> = {
  [Messages.EARTHQUAKE]: ["event.rumble"],
  [Messages.EXPLOSION_REPORTED]: ["event.explosion_big"],
  [Messages.FIRE_REPORTED]: ["event.alarm"],
  [Messages.FLOODING_REPORTED]: ["event.thunder"],
  [Messages.TORNADO_SIGHTED]: ["event.thunder"],
  [Messages.MONSTER_SIGHTED]: ["event.rumble"],
  [Messages.NUCLEAR_MELTDOWN]: ["event.alarm", "event.explosion_big"],
  [Messages.PLANE_CRASHED]: ["event.explosion_big"],
  [Messages.HELICOPTER_CRASHED]: ["event.explosion_small"],
  [Messages.TRAIN_CRASHED]: ["event.crash", "event.explosion_small"],
  [Messages.SHIP_CRASHED]: ["event.crash"],
  [Messages.BLACKOUTS_REPORTED]: ["event.blackout"],
  [Messages.NOT_ENOUGH_POWER]: ["event.blackout"],
  [Messages.NO_MONEY]: ["event.bankrupt"],
  [Messages.REACHED_TOWN]: ["ui.milestone"],
  [Messages.REACHED_CITY]: ["ui.milestone"],
  [Messages.REACHED_CAPITAL]: ["ui.milestone"],
  [Messages.REACHED_METROPOLIS]: ["ui.milestone"],
  [Messages.REACHED_MEGALOPOLIS]: ["ui.milestone"],
};

const GROUP_SOUNDS: Record<Exclude<MessageGroup, null>, string> = {
  good: "ui.notify_good",
  bad: "ui.notify_bad",
  neutral: "ui.notify_neutral",
};

// Sound signals that sprites emit (forwarded by the sprite manager)
export const SPRITE_SOUNDS: Record<string, string> = {
  [Messages.SOUND_EXPLOSIONHIGH]: "event.explosion_small",
  [Messages.SOUND_MONSTER]: "event.rumble",
  [Messages.SOUND_HEAVY_TRAFFIC]: "event.helicopter",
  [Messages.SOUND_HONKHONK]: "event.ship_horn",
};

// The bulldozer signals the size of what it knocked down
export const BULLDOZER_SOUNDS: Record<string, string> = {
  [Messages.SOUND_EXPLOSIONHIGH]: "tool.demolish",
  [Messages.SOUND_EXPLOSIONLOW]: "tool.demolish_low",
};

const TOOL_SOUNDS: Record<string, string> = {
  residential: "tool.zone",
  commercial: "tool.zone",
  industrial: "tool.zone",
  road: "tool.road",
  rail: "tool.rail",
  wire: "tool.wire",
  park: "tool.park",
  bulldozer: "tool.bulldoze",
  query: "tool.query",
  police: "tool.building",
  fire: "tool.building",
  port: "tool.building",
  airport: "tool.building",
  stadium: "tool.building",
  coal: "tool.building",
  nuclear: "tool.building",
  waterworks: "tool.building",
  watertower: "tool.building",
  gas: "tool.building",
  hydro: "tool.building",
  solar: "tool.building",
  wind: "tool.building",
  limestone_mine: "tool.building",
  potash_mine: "tool.building",
  tin_mine: "tool.building",
  zinc_mine: "tool.building",
  gold_mine: "tool.building",
  gem_mine: "tool.building",
  rare_earth_mine: "tool.building",
  lignite_mine: "tool.building",
  oil_well: "tool.building",
  farm: "tool.park",
  road_asphalt: "tool.road",
  road_concrete2: "tool.road",
  road_concrete4: "tool.road",
  road_concrete6: "tool.road",
  road_concrete8: "tool.road",
  motorway: "tool.road",
  tollway: "tool.road",
  road_upgrade: "tool.road",
  fishing: "tool.building",
  // PhaiCity: the ruler's house, the schools and hospitals, and the rubbish and wastewater buildings
  ruler_house: "tool.building",
  ruler_house_upgrade: "tool.building",
  kindergarten: "tool.building",
  primary_school: "tool.building",
  secondary_school: "tool.building",
  vocational_college: "tool.building",
  university: "tool.building",
  health_centre: "tool.building",
  community_hospital: "tool.building",
  provincial_hospital: "tool.building",
  regional_hospital: "tool.building",
  landfill: "tool.building",
  incinerator: "tool.building",
  recycling_plant: "tool.building",
  waste_power_plant: "tool.building",
  wastewater_plant: "tool.building",
  bus_stop: "tool.building",
  train_station: "tool.building",
  metro_station: "tool.building",
  hsr_station: "tool.building",
  land: "tool.building",
};

// BaseTool.TOOLRESULT_* values
export const TOOL_RESULT = { OK: 0, FAILED: 1, NO_MONEY: 2, NEEDS_BULLDOZE: 3 } as const;

export function soundsForMessage(subject: string, group: MessageGroup): string[] {
  const specific = MESSAGE_SOUNDS[subject];
  if (specific) return specific;
  return group ? [GROUP_SOUNDS[group]] : [];
}

export function soundForTool(tool: string | null, result: number): string | null {
  if (!tool) return null;
  if (result !== TOOL_RESULT.OK) return "ui.error";
  return TOOL_SOUNDS[tool] ?? null;
}

// --- Ambience from the tiles on screen ---

export interface ViewStats {
  total: number;
  water: number;
  woods: number;
  developed: number;
  industrial: number;
  airport: number;
  stadiumGame: number;
  /** Also counted within developed: road tiles, those with traffic, and commercial zones. */
  roads: number;
  traffic: number;
  commercial: number;
}

type TileKind = Exclude<keyof ViewStats, "total" | "roads" | "traffic" | "commercial">;

// Tile value ranges from src/tileValues.ts
export function classifyTile(tile: number): TileKind | null {
  if (tile >= 2 && tile <= 20) return "water";
  if (tile >= 21 && tile <= 39) return "woods";
  if (tile >= 64 && tile <= 611) return "developed"; // roads, power lines, rail, homes and shops
  if ((tile >= 612 && tile <= 692) || (tile >= 745 && tile <= 760) || (tile >= 811 && tile <= 826) ||
      (tile >= 844 && tile <= 859) || (tile >= 916 && tile <= 931) || (tile >= 952 && tile <= 955)) return "industrial";
  if (tile >= 709 && tile <= 744) return "airport";
  if (tile >= 932 && tile <= 947) return "stadiumGame";
  return null;
}

export interface TileSource {
  width: number;
  height: number;
  getTileValue(x: number, y: number): number;
}

export type { TileRect };

/** Counts tile kinds in the rectangle (inclusive), sampling a grid when the view is large. */
export function sampleView(map: TileSource, rect: TileRect, maxSamples = 2500): ViewStats {
  const stats: ViewStats = { total: 0, water: 0, woods: 0, developed: 0, industrial: 0, airport: 0, stadiumGame: 0,
    roads: 0, traffic: 0, commercial: 0 };
  const x0 = Math.max(0, rect.x0);
  const y0 = Math.max(0, rect.y0);
  const x1 = Math.min(map.width - 1, rect.x1);
  const y1 = Math.min(map.height - 1, rect.y1);
  if (x1 < x0 || y1 < y0) return stats;
  const step = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0 + 1) * (y1 - y0 + 1)) / maxSamples)));
  for (let y = y0; y <= y1; y += step) {
    for (let x = x0; x <= x1; x += step) {
      stats.total++;
      const tile = map.getTileValue(x, y);
      const kind = classifyTile(tile);
      if (kind) stats[kind]++;
      // Roads 64–206, with traffic from 80 (src/tileValues.ts LTRFBASE); commercial zones 423–609
      if (tile >= 64 && tile <= 206) stats.roads++;
      if (tile >= 80 && tile <= 206) stats.traffic++;
      if (tile >= 423 && tile <= 609) stats.commercial++;
    }
  }
  return stats;
}

export const AMBIENCE_BEDS = ["amb.nature", "amb.industrial", "amb.city", "amb.market", "amb.waves", "amb.rain"];

/** How loud each looping bed should be for this view (and weather), 0-1. */
export function ambienceLevels(stats: ViewStats, raining = false): Record<string, number> {
  const rain = raining ? 0.8 : 0;
  if (stats.total === 0) {
    return { "amb.nature": 0, "amb.industrial": 0, "amb.city": 0, "amb.market": 0, "amb.waves": 0, "amb.rain": rain };
  }
  const share = (n: number): number => n / stats.total;
  const nature = (share(stats.woods) * 2 + share(stats.water) * 0.5) * (1 - Math.min(0.7, share(stats.developed)));
  return {
    "amb.nature": Math.min(1, nature),
    "amb.industrial": Math.min(1, share(stats.industrial) * 5),
    // Streets: roads in view, louder where they are busy
    "amb.city": Math.min(1, share(stats.roads) * 2.5 + share(stats.traffic) * 4),
    // A market where shops fill the view
    "amb.market": Math.min(1, Math.max(0, share(stats.commercial) - 0.05) * 3),
    // Waves where water fills a good part of the view (a coast, a wide river)
    "amb.waves": Math.min(1, Math.max(0, share(stats.water) - 0.15) * 2.5),
    "amb.rain": rain,
  };
}

/** The sky now as the game shows it (src/rainSpells.ts): its kind and how hard it rains */
export interface SkyHeard {
  kind: string;
  rain: number;
}

/**
 * What the ears hear of the sky now: rain only while a spell rains, as the 3D view and the time bar show it (owner,
 * 21 Oct 2026: "ฝนตกบ่อยเกินไปมากๆ"), and thunder only in a storm. The city itself never hears it.
 */
export function rainHeard(sky: SkyHeard | null | undefined): { raining: boolean; thunder: boolean } {
  const raining = !!sky && sky.rain > 0.05 && (sky.kind === "rain" || sky.kind === "storm");
  return { raining, thunder: raining && sky?.kind === "storm" };
}

/** Occasionally picks a short ambience sound that fits the view and the weather, or null. */
export function pickAmbientOneShot(stats: ViewStats, raining: boolean, random: () => number,
    thunder = false): string | null {
  if (stats.total === 0) return null;
  const share = (n: number): number => n / stats.total;
  const candidates: Array<[boolean, number, string]> = [
    [stats.stadiumGame > 0, 0.08, "amb.crowd"],
    [stats.airport > 0, 0.05, "amb.airplane"],
    [thunder, 0.15, "amb.thunder"],
    [share(stats.water) > 0.2, 0.05, "amb.seagull"],
    [share(stats.water) > 0.1 && share(stats.developed) > 0.1, 0.04, "vehicle.longtail_boat"],
    [share(stats.roads) > 0.1, 0.06, "vehicle.tuktuk"],
    [share(stats.roads) > 0.05, 0.05, "vehicle.motorcycle"],
    [share(stats.woods) > 0.1, 0.04, "amb.rooster"],
    [share(stats.woods) > 0.15 && !raining, 0.08, "amb.night_cicadas"],
  ];
  for (const [fits, chance, id] of candidates) {
    if (fits && random() < chance) return id;
  }
  return null;
}

// --- Glue to a running game (browser only) ---

interface Emitter {
  addEventListener(event: string, listener: (value: any) => void): void;
}

export interface GameLike {
  simulation: Emitter & {
    spriteManager: Emitter;
    getDate(): { month: number; year: number };
  };
  inputStatus: Emitter & { gameTools: { bulldozer: Emitter } };
  gameMap: TileSource;
  /** The sky now (src/rainSpells.ts), whose rain and thunder the ambience follows */
  skyNow?: SkyHeard | null;
  /** The game's clock (src/dayClock.ts), whose dawn and dusk ring the temple bell (src/audio/templeBells.ts) */
  dayClock?: { hour: number } | null;
  /** The 2D or 3D view (src/cityView.ts): its width for panning, and the tiles on screen for ambience. */
  cityView: Pick<CityView, "width" | "visibleTiles">;
}

export interface MessageGroups {
  goodMessages: Record<string, unknown>;
  badMessages: Record<string, unknown>;
  neutralMessages: Record<string, unknown>;
}

export interface GameAudio {
  /** Called by the game after each use of a tool; x is the click position on the canvas. */
  toolUsed(tool: string | null, result: number, canvasX?: number): void;
  dispose(): void;
}

const AMBIENCE_INTERVAL_MS = 3000;
const TOOL_PAN_WIDTH = 0.5;

export function attachGameAudio(game: GameLike, player: SoundPlayer, groups: MessageGroups): GameAudio {
  const groupOf = (subject: string): MessageGroup =>
    subject in groups.goodMessages ? "good" : subject in groups.badMessages ? "bad" :
      subject in groups.neutralMessages ? "neutral" : null;

  game.simulation.addEventListener(Messages.FRONT_END_MESSAGE, (message: { subject: string }) => {
    for (const id of soundsForMessage(message.subject, groupOf(message.subject))) player.play(id);
  });

  // Coins when money comes in (yearly taxes), not when it is spent
  let lastFunds: number | null = null;
  game.simulation.addEventListener(Messages.FUNDS_CHANGED, (funds: number) => {
    if (lastFunds !== null && funds > lastFunds) player.play("ui.coin");
    lastFunds = funds;
  });

  for (const [signal, id] of Object.entries(SPRITE_SOUNDS)) {
    game.simulation.spriteManager.addEventListener(signal, () => player.play(id));
  }
  for (const [signal, id] of Object.entries(BULLDOZER_SOUNDS)) {
    game.inputStatus.gameTools.bulldozer.addEventListener(signal, () => player.play(id));
  }
  game.inputStatus.addEventListener(Messages.SAVE_REQUESTED, () => player.play("ui.save"));

  const bells = new TempleBells();
  const updateAmbience = (): void => {
    let rect: TileRect | null;
    try {
      rect = game.cityView.visibleTiles();
    } catch {
      return; // The view is not ready yet
    }
    if (!rect) return;
    const sky = rainHeard(game.skyNow);
    const stats = sampleView(game.gameMap, rect);
    const levels = ambienceLevels(stats, sky.raining);
    for (const id of AMBIENCE_BEDS) player.setLoop(id, levels[id] ?? 0);
    const oneShot = pickAmbientOneShot(stats, sky.raining, Math.random, sky.thunder);
    if (oneShot) player.play(oneShot);    // The temple bell at dawn and dusk, softly, with a temple on screen (docs/GAME_DESIGN.md 9.5)
    if (game.dayClock && bells.ring(game.dayClock.hour, game.simulation.getDate().month,
      templeInView(game.gameMap as Parameters<typeof templeInView>[0], rect))) player.play("event.temple_bell", { volume: BELL_VOLUME });
  };
  const timer = window.setInterval(updateAmbience, AMBIENCE_INTERVAL_MS);
  updateAmbience();

  return {
    toolUsed(tool, result, canvasX) {
      const id = soundForTool(tool, result);
      if (!id) return;
      const width = game.cityView.width;
      const pan = canvasX !== undefined && width > 0 ? ((canvasX / width) * 2 - 1) * TOOL_PAN_WIDTH : 0;
      player.play(id, { pan });
    },
    dispose() {
      window.clearInterval(timer);
      for (const id of AMBIENCE_BEDS) player.setLoop(id, 0);
    },
  };
}
