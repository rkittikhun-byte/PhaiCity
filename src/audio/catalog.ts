/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every sound the game can play. Files live in assets/audio/sfx/ (built by npm run audio:build from
// scripts/audio/sfx-manifest.json); several ids may share one file. Ids follow docs/audio/SOUND_LIST.md.

export type Channel = "effects" | "ambience" | "ui" | "music";

export interface SoundDef {
  file: string;
  channel: Channel;
  /** Gain before the channel volume, 0-1. */
  volume: number;
  /** Long recordings are cut here, with a short fade, when played as one-shots (seconds). */
  maxDuration?: number;
  /** The same sound is not started again within this time (milliseconds). */
  minGap?: number;
  /** Ambience beds loop until faded out. */
  loop?: boolean;
}

export const SOUNDS: Record<string, SoundDef> = {
  // Interface
  "ui.click": { file: "ui-click.ogg", channel: "ui", volume: 0.45 },
  "ui.select": { file: "ui-select.ogg", channel: "ui", volume: 0.4 },
  "ui.open": { file: "ui-open.ogg", channel: "ui", volume: 0.45 },
  "ui.close": { file: "ui-close.ogg", channel: "ui", volume: 0.45 },
  "ui.error": { file: "ui-error.ogg", channel: "ui", volume: 0.5, minGap: 400 },
  "ui.save": { file: "ui-save.ogg", channel: "ui", volume: 0.55 },
  "ui.coin": { file: "ui-coin.ogg", channel: "ui", volume: 0.6, minGap: 1000 },
  "ui.lang": { file: "ui-switch.ogg", channel: "ui", volume: 0.5 },
  "ui.speed": { file: "ui-toggle.ogg", channel: "ui", volume: 0.5 },
  "ui.notify_neutral": { file: "ui-notify-neutral.ogg", channel: "ui", volume: 0.35, minGap: 15000 },
  "ui.notify_bad": { file: "ui-notify-bad.ogg", channel: "ui", volume: 0.45, minGap: 4000 },
  "ui.notify_good": { file: "ui-notify-good.ogg", channel: "ui", volume: 0.5, minGap: 4000 },
  "ui.milestone": { file: "gong.ogg", channel: "ui", volume: 0.6, minGap: 4000 },

  // Tools
  "tool.zone": { file: "tool-zone.ogg", channel: "effects", volume: 0.6, minGap: 120 },
  "tool.road": { file: "tool-road.ogg", channel: "effects", volume: 0.5, minGap: 120 },
  "tool.rail": { file: "tool-rail.ogg", channel: "effects", volume: 0.45, minGap: 120 },
  "tool.wire": { file: "tool-wire.ogg", channel: "effects", volume: 0.3, minGap: 120 },
  "tool.park": { file: "tool-park.ogg", channel: "effects", volume: 0.5, minGap: 120 },
  "tool.building": { file: "tool-building.ogg", channel: "effects", volume: 0.55, minGap: 200 },
  "tool.bulldoze": { file: "tool-bulldoze.ogg", channel: "effects", volume: 0.45, minGap: 120 },
  "tool.demolish": { file: "explosion-small.ogg", channel: "effects", volume: 0.55, minGap: 150 },
  "tool.demolish_low": { file: "crunch.ogg", channel: "effects", volume: 0.5, minGap: 150 },
  "tool.query": { file: "tool-query.ogg", channel: "effects", volume: 0.4 },

  // Events
  "event.explosion_big": { file: "explosion-big.ogg", channel: "effects", volume: 0.8, maxDuration: 6, minGap: 1000 },
  "event.explosion_small": { file: "explosion-small.ogg", channel: "effects", volume: 0.6, minGap: 300 },
  "event.rumble": { file: "rumble.ogg", channel: "effects", volume: 0.8, maxDuration: 7, minGap: 5000 },
  "event.thunder": { file: "thunder.ogg", channel: "effects", volume: 0.7, maxDuration: 8, minGap: 5000 },
  "event.alarm": { file: "alarm.ogg", channel: "effects", volume: 0.45, maxDuration: 5, minGap: 8000 },
  "event.crash": { file: "crash-metal.ogg", channel: "effects", volume: 0.7, minGap: 500 },
  "event.blackout": { file: "power-down.ogg", channel: "effects", volume: 0.5, minGap: 10000 },
  "event.bankrupt": { file: "bankrupt.ogg", channel: "effects", volume: 0.5, minGap: 10000 },
  "event.helicopter": { file: "helicopter.ogg", channel: "effects", volume: 0.45, maxDuration: 5, minGap: 20000 },
  "event.crowd": { file: "crowd.ogg", channel: "effects", volume: 0.4, maxDuration: 6, minGap: 20000 },
  "event.ship_horn": { file: "ship-horn.ogg", channel: "effects", volume: 0.45, minGap: 30000 },
  "event.temple_bell": { file: "temple-bell.ogg", channel: "effects", volume: 0.6, maxDuration: 6, minGap: 10000 },
  "vehicle.tuktuk": { file: "tuktuk.ogg", channel: "effects", volume: 0.5, maxDuration: 5, minGap: 8000 },
  "vehicle.longtail_boat": { file: "longtail-boat.ogg", channel: "effects", volume: 0.55, maxDuration: 6, minGap: 10000 },
  "vehicle.motorcycle": { file: "motorcycle.ogg", channel: "effects", volume: 0.45, maxDuration: 4, minGap: 5000 },

  // Ambience: looping beds and occasional one-shots
  "amb.nature": { file: "amb-nature.ogg", channel: "ambience", volume: 0.5, loop: true },
  "amb.industrial": { file: "amb-industrial.ogg", channel: "ambience", volume: 0.25, loop: true },
  "amb.city": { file: "amb-city.ogg", channel: "ambience", volume: 0.35, loop: true },
  "amb.market": { file: "amb-market.ogg", channel: "ambience", volume: 0.3, loop: true },
  "amb.waves": { file: "amb-waves.ogg", channel: "ambience", volume: 0.4, loop: true },
  "amb.rain": { file: "amb-rain.ogg", channel: "ambience", volume: 0.45, loop: true },
  "amb.night_cicadas": { file: "amb-night-cicadas.ogg", channel: "ambience", volume: 0.4, loop: true },
  "amb.seagull": { file: "seagull.ogg", channel: "ambience", volume: 0.4, maxDuration: 6, minGap: 30000 },
  "amb.rooster": { file: "rooster.ogg", channel: "ambience", volume: 0.35, minGap: 60000 },
  "amb.thunder": { file: "thunder.ogg", channel: "ambience", volume: 0.5, maxDuration: 8, minGap: 45000 },
  "amb.airplane": { file: "airplane.ogg", channel: "ambience", volume: 0.35, maxDuration: 10, minGap: 60000 },
  "amb.crowd": { file: "crowd.ogg", channel: "ambience", volume: 0.3, maxDuration: 6, minGap: 30000 },
};
