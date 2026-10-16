/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Plays a new Mueang Khon Kaen city for years with the auto player (src/core/autoPlayer.ts) and prints each year's
// people, money and accounts, to check the game's balance. It only runs when asked, as it takes about 3 s a year:
//   PHAICITY_PLAY=1 npx jest --coverage=false test/play
// PHAICITY_YEARS sets the years (10), PHAICITY_PLOTS=1 adds what holds each kind and level of plot back each year,
// PHAICITY_PLAY_OUT a file for the whole report as JSON, PHAICITY_PLAY_SAVE a file of the city as the game saves it.

import * as fs from "fs";
import { AutoPlayer, type PlayerYear, plotReport } from "../../src/core/autoPlayer";
import { CityCore } from "../../src/core/cityCore";
import { firstFrame } from "../../src/cityFrame";
import { DISTRICT_BLOCK, framePreset, isDistrictMap } from "../../src/geo/districtFrame";
import { decodePresetCells, decodePresetLayer } from "../../src/geo/presetMap";
import { checkProfilesData, measuredLevels, provinceLevels } from "../../src/geo/provinceResources";
import { startingFunds } from "../../src/geo/provinceProfile";
import { MapGenerator } from "../../src/mapGenerator.js";
import { checkRulesData, resolveRules } from "../../src/provinceRules";
import { keepHigherRank, RANKS, rankForCityClass } from "../../src/rulerRank";
import { encodeMap } from "../../src/cityStorage";

const read = (path: string) => JSON.parse(fs.readFileSync(path, "utf8"));

/** A new city on a district's map, set up as the game's start screen sets one up (src/splashScreen.js startProvince) */
async function newCity(districtId: string, provinceId: string, region: string) {
  const whole = read(`data/maps/district/${districtId}.json`);
  const preset = isDistrictMap(whole) ? await framePreset(whole, firstFrame(whole, whole.town, DISTRICT_BLOCK)) : whole;
  const layer = (encoded: string | undefined) => (encoded ? decodePresetLayer(encoded, preset.width, preset.height) : null);
  const transport = layer(preset.transport);
  const map = (MapGenerator as any).fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
  Object.assign(map, {
    nationalTransport: transport, insideProvince: layer(preset.inside), town: preset.town || null, provinceId,
    districtId: preset.districtId || null, tileSizeM: preset.tileSizeM || null, mapCenter: preset.center || null,
    frame: preset.frame || null, districtPlace: preset.district || null, paintedZones: preset.paintedZones === true,
    cellZones: preset.cellZones === true, roadLevels: layer(preset.roadLevels),
    // What covers its open land, which makes the land beside it worth more (src/blockMapUtils.js)
    landCover: layer(preset.landCover),
  });
  const rules = resolveRules(checkRulesData(read("data/province-rules.json")).data, region, provinceId);
  const measured = measuredLevels(read("data/geo/province-indicators.json").provinces);
  const entry = checkProfilesData(read("data/province-profiles.json")).data.provinces[provinceId];
  const resources: Record<string, number> = {};
  provinceLevels(measured[provinceId], entry).forEach((r) => { resources[r.id] = r.level; });
  // The ruler's rank follows the city's class and is never lost, as in the game (src/game.js)
  let rank: string = "muen";
  const core: CityCore = new CityCore({ map, seed: 11, rules, resources,
    hooks: { rank: () => Math.max(0, RANKS.indexOf(rank as never)) } } as never);
  core.on("month", () => { rank = keepHigherRank(rank as never, rankForCityClass(core.simulation.evaluation.cityClass)); });
  (core as unknown as { rank: () => string }).rank = () => rank;
  core.simulation.budget.setFunds(startingFunds(preset.stats) || 20000);
  return core;
}

const row = (y: PlayerYear) => {
  const lines = (r: Record<string, number>) => Object.entries(r).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ");
  return `year ${y.year}: ${y.population} people, ฿${y.funds} (built ฿${y.built}), ${y.cityClass}, ${y.approval}% happy, land value ${y.landValue}, pollution ${y.pollution}, power used ${y.powerUse}%, water ${y.water.used}/${y.water.supply} from ${y.water.works} works, ` +
    `demand ${y.demand.join("/")}\n  in: ${lines(y.accounts.income)}\n  out: ${lines(y.accounts.costs)}\n  net ${y.accounts.net}\n`;
};

(process.env.PHAICITY_PLAY ? test : test.skip)("play Mueang Khon Kaen for years", async () => {
  const core = await newCity("TH-40-mueang-khon-kaen", "TH-40", "northeast");
  const player = new AutoPlayer(core, { town: core.map.town });
  player.start();
  const years: PlayerYear[] = [];
  for (let n = 0; n < Number(process.env.PHAICITY_YEARS || 10); n++) {
    const year = player.playYear();
    years.push(year);
    process.stdout.write(row(year));
    if (process.env.PHAICITY_PLOTS) {
      const pct = (label: string, v: number) => (v ? `, ${label} ${Math.round(v * 100)}%` : "");
      for (const g of plotReport(core)) {
        process.stdout.write(`    ${g.kind} ${g.level}: ${g.count}, land ${g.landValue} (near ${g.nearness} + open ${g.openLand} - pollution ${g.pollution} - crime ${g.crime})` +
          (g.score !== null ? `, score ${g.score}` : "") + pct("no power", g.unpowered) + pct("thirsty", g.thirsty) + pct("of them no pipe", g.unpiped) +
          pct("polluted", g.polluted) + pct("too quiet", g.tooQuiet) + pct("land too cheap", g.landCaps) + "\n");
      }
    }
  }
  process.stdout.write(player.log.join("\n") + "\n");
  // The city as the game saves it (src/game.js saveData, src/cityStorage.ts), to open in the browser: { save, meta }
  if (process.env.PHAICITY_PLAY_SAVE) {
    const rank = (core as unknown as { rank: () => string }).rank(), date = core.simulation.getDate();
    const save: Record<string, unknown> = { ...core.save(), name: "ขอนแก่น เล่นอัตโนมัติ", provinceId: "TH-40",
      districtId: core.map.districtId, rulerRank: rank, news: [], version: 4 };
    save.mapRle = encodeMap(save.map as Array<{ value: number }>); delete save.map;
    const meta = { name: save.name, provinceId: "TH-40", districtId: core.map.districtId, population: core.simulation.evaluation.cityPop,
      funds: core.simulation.budget.totalFunds, year: date.year, month: date.month, rank };
    fs.writeFileSync(process.env.PHAICITY_PLAY_SAVE, JSON.stringify({ save, meta }));
  }
  if (process.env.PHAICITY_PLAY_OUT) fs.writeFileSync(process.env.PHAICITY_PLAY_OUT, JSON.stringify({ years, log: player.log }, null, 1));
}, 3600000);
