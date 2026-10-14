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

import { Position } from './position.ts';
import { levelEffect, levelUpkeep } from './buildingLevels.ts';
import { FIRESTATION, POLICESTATION } from "./tileValues.ts";

// PhaiCity: group is the station's levels (src/buildingLevels.ts): a higher one does more and costs more to keep
var handleService = function(censusStat, budgetEffect, blockMap, group, upkeepStat) {
  return function(map, x, y, simData) {
    simData.census[censusStat] += 1;
    simData.census[upkeepStat] += levelUpkeep(map, x, y, group);

    var effect = Math.floor(simData.budget[budgetEffect] * levelEffect(map, x, y, group));
    var isPowered = map.getTile(x, y).isPowered();
    // Unpowered buildings are half as effective
    if (!isPowered)
      effect = Math.floor(effect / 2);

    var pos = new Position(x, y);
    var connectedToRoads = simData.trafficManager.findPerimeterRoad(pos);
    if (!connectedToRoads)
      effect = Math.floor(effect / 2);

    var currentEffect = simData.blockMaps[blockMap].worldGet(x, y);
    currentEffect += effect;
    simData.blockMaps[blockMap].worldSet(x, y, currentEffect);
  };
};


var policeStationFound = handleService('policeStationPop', 'policeEffect', 'policeStationMap', 'police',
                                       'policeUpkeepUnits');
var fireStationFound = handleService('fireStationPop', 'fireEffect', 'fireStationMap', 'fire', 'fireUpkeepUnits');


var EmergencyServices = {
  registerHandlers: function(mapScanner, repairManager) {
    mapScanner.addAction(POLICESTATION, policeStationFound);
    mapScanner.addAction(FIRESTATION, fireStationFound);
  }
};


export { EmergencyServices };
