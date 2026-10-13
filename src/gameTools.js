/* micropolisJS. Adapted by Graeme McCutcheon from Micropolis.
 *
 * This code is released under the GNU GPL v3, with some additional terms.
 * Please see the files LICENSE and COPYING for details. Alternatively,
 * consult http://micropolisjs.graememcc.co.uk/LICENSE and
 * http://micropolisjs.graememcc.co.uk/COPYING
 *
 * The name/term "MICROPOLIS" is a registered trademark of Micropolis (https://www.micropolis.com) GmbH
 * (Micropolis Corporation, the "licensor") and is licensed here to the authors/publishers of the "Micropolis"
 * city simulation game and its source code (the project or "licensee(s)") as a courtesy of the owner.
 *
 */

import { BuildingTool } from './buildingTool.js';
import { BulldozerTool } from './bulldozerTool.js';
import { EventEmitter } from './eventEmitter.js';
import { QUERY_WINDOW_NEEDED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { ParkTool } from './parkTool.js';
import { DEFAULT_RULES, TOOL_COSTS } from './provinceRules.ts';
import { PLANT_TOOLS, POWER_KINDS } from './powerPlants.ts';
import { MINE_KINDS, MINE_TOOLS } from './mining.ts';
import { RailTool } from './railTool.js';
import { RoadTool } from './roadTool.js';
import { QueryTool } from './queryTool.js';
import { WaterTowerTool } from './waterTowerTool.ts';
import { RoadUpgradeTool } from './roadLevels.ts';
import { RulerHouseUpgradeTool } from './rulerHouse.ts';
import { SERVICE_KINDS, SERVICE_SPECS } from './services.ts';
import * as TileValues from "./tileValues.ts";
import { WireTool } from './wireTool.js';

// rules (PhaiCity): the province's rules (src/provinceRules.ts), which set each tool's price and the price of clearing
// woods; none means the game's own
function GameTools(map, rules) {
  rules = rules || DEFAULT_RULES;
  var tools = EventEmitter({
    airport: new BuildingTool(10000, TileValues.AIRPORT, map, 6, false),
    bulldozer: new BulldozerTool(map),
    coal: new BuildingTool(3000, TileValues.POWERPLANT, map, 4, false),
    // PhaiCity: the other kinds of power plant, on the coal plant's tiles (src/powerPlants.ts)
    gas: new BuildingTool(4000, TileValues.POWERPLANT, map, 4, false),
    hydro: new BuildingTool(6000, TileValues.POWERPLANT, map, 4, false),
    solar: new BuildingTool(2500, TileValues.POWERPLANT, map, 4, false),
    wind: new BuildingTool(3500, TileValues.POWERPLANT, map, 4, false),
    // PhaiCity: mines and oil wells, one 3x3 building for every kind (src/mining.ts)
    limestone_mine: new BuildingTool(1500, TileValues.MINE, map, 3, false),
    potash_mine: new BuildingTool(2500, TileValues.MINE, map, 3, false),
    tin_mine: new BuildingTool(2000, TileValues.MINE, map, 3, false),
    zinc_mine: new BuildingTool(2500, TileValues.MINE, map, 3, false),
    gold_mine: new BuildingTool(3000, TileValues.MINE, map, 3, false),
    gem_mine: new BuildingTool(1500, TileValues.MINE, map, 3, false),
    rare_earth_mine: new BuildingTool(4000, TileValues.MINE, map, 3, false),
    lignite_mine: new BuildingTool(2500, TileValues.MINE, map, 3, false),
    oil_well: new BuildingTool(3500, TileValues.MINE, map, 3, false),
    // PhaiCity: farms and fishing harbours (src/farming.ts)
    farm: new BuildingTool(300, TileValues.FARM, map, 3, false),
    fishing: new BuildingTool(1200, TileValues.HARBOUR, map, 3, false),
    commercial: new BuildingTool(100, TileValues.COMCLR, map, 3, false),
    fire: new BuildingTool(500, TileValues.FIRESTATION, map, 3, false),
    industrial: new BuildingTool(100, TileValues.INDCLR, map, 3, false),
    nuclear: new BuildingTool(5000, TileValues.NUCLEAR, map, 4, true),
    park: new ParkTool(map),
    police: new BuildingTool(500, TileValues.POLICESTATION, map, 3, false),
    port: new BuildingTool(3000, TileValues.PORT, map, 4, false),
    rail: new RailTool(map),
    residential: new BuildingTool(100, TileValues.FREEZ, map, 3, false),
    road: new RoadTool(map),
    // PhaiCity: the road levels and the upgrade tool (src/roadLevels.ts)
    road_asphalt: new RoadTool(map, 20, 2),
    road_concrete2: new RoadTool(map, 30, 3),
    road_concrete4: new RoadTool(map, 50, 4),
    road_concrete6: new RoadTool(map, 80, 5),
    road_concrete8: new RoadTool(map, 120, 6),
    motorway: new RoadTool(map, 200, 7),
    tollway: new RoadTool(map, 250, 8),
    road_upgrade: new RoadUpgradeTool(map),
    // PhaiCity: the ruler's house, a new city's first building, and its upgrade (src/rulerHouse.ts)
    ruler_house: new BuildingTool(500, TileValues.CIVIC, map, 3, false),
    ruler_house_upgrade: new RulerHouseUpgradeTool(map),
    query: new QueryTool(map),
    stadium: new BuildingTool(5000, TileValues.STADIUM, map, 4, false),
    // PhaiCity: the water supply (src/waterManager.ts)
    watertower: new WaterTowerTool(map),
    waterworks: new BuildingTool(1500, TileValues.WATER_WORKS, map, 3, false),
    wire: new WireTool(map),
  });

  // PhaiCity: schools and hospitals (src/services.ts), on the ruler's house's civic tiles; the map records which
  SERVICE_KINDS.forEach(function(kind) {
    tools[kind] = new BuildingTool(SERVICE_SPECS[kind].price, TileValues.CIVIC, map, 3, false);
    tools[kind].civicKind = kind;
  });

  TOOL_COSTS.forEach(function(name) {
    tools[name].costFactor = rules.cost[name];
    tools[name].clearWoodsCost = rules.clearWoodsCost;
  });

  // What kind of plant each power tool builds; the map records it where it stands (src/cityCommands.ts)
  POWER_KINDS.forEach(function(kind) {
    tools[PLANT_TOOLS[kind]].powerKind = kind;
  });
  MINE_KINDS.forEach(function(kind) {
    tools[MINE_TOOLS[kind]].mineKind = kind;
  });
  // The map records where the ruler's house stands (src/cityCommands.ts)
  tools.ruler_house.rulerHouse = true;

  tools.query.addEventListener(QUERY_WINDOW_NEEDED, MiscUtils.reflectEvent.bind(tools, QUERY_WINDOW_NEEDED));

  return tools;
}


export { GameTools };
