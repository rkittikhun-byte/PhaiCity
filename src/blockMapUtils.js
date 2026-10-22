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

import { BlockMap } from './blockMap.ts';
import { Commercial } from './commercial.js';
import { Industrial } from './industrial.js';
import { MiscUtils } from './miscUtils.js';
import { plotDensity } from './plots.ts';
import { isCityTileSize } from './units.ts';
import { pollutionField } from './sim/pollutionField.ts';
import { Random } from './random.ts';
import { Residential } from './residential.js';
import * as TileValues from "./tileValues.ts";

// Smoothing styles for map smoothing
var SMOOTH_NEIGHBOURS_THEN_BLOCK = 0;
var SMOOTH_ALL_THEN_CLAMP = 1;

// PhaiCity: the land covers of a real map (gameMap.landCover, scripts/geo/lib/landCover.mjs COVER) that are open land
// for the land value: paddy, field, orchard, grass and wetland, but not a village or the town
var OPEN_COVER = [false, true, true, true, true, true, false, false];


// Smooth the map src into dest. The way in which the map is smoothed depends on the value of smoothStyle.
// The meanings are as follows:
//
// SMOOTH_NEIGHBOURS_THEN_BLOCK
// ============================
// For each square in src, sum the values of its immediate neighbours, and take the average, then take the average of
// that result and the square's value. This result is the new value of the square in dest.
//
// SMOOTH_ALL_THEN_CLAMP
// =====================
// For each square in src, sum the values of that square and it's four immediate neighbours, and take an average
// rounding down. Clamp the resulting value in the range 0-255. This clamped value is the square's new value in dest.
var smoothMap = function(src, dest, smoothStyle) {
  for (var x = 0, width = src.width; x < width; x++) {
    for (var y = 0, height = src.height; y < height; y++) {
      var edges = 0;

      if (x > 0)
        edges += src.get(x - 1, y);

      if (x < src.width - 1)
        edges += src.get(x + 1, y);

      if (y > 0)
        edges += src.get(x, y - 1);

      if (y < src.height - 1)
        edges += src.get(x, y + 1);

      if (smoothStyle === SMOOTH_NEIGHBOURS_THEN_BLOCK) {
        edges = src.get(x, y) + Math.floor(edges / 4);
        dest.set(x, y, Math.floor(edges/2));
      } else {
        edges = (edges + src.get(x, y)) >> 2;
        if (edges > 255)
          edges = 255;
        dest.set(x, y, edges);
      }
    }
  }
};


// Over time, the rate of growth of a neighbourhood should trend towards zero (stable)
var neutraliseRateOfGrowthMap = function(blockMaps) {
  var rateOfGrowthMap = blockMaps.rateOfGrowthMap;
  for (var x = 0, width = rateOfGrowthMap.width; x < width; x++) {
    for (var y = 0, height = rateOfGrowthMap.height; y < height; y++) {
      var rate = rateOfGrowthMap.get(x, y);
      if (rate === 0)
        continue;

      if (rate > 0)
        rate--;
      else
        rate++;

      rate = MiscUtils.clamp(rate, -200, 200);
      rateOfGrowthMap.set(x, y, rate);
    }
  }
};


// Over time, traffic density should ease.
var neutraliseTrafficMap = function(blockMaps) {
  var trafficDensityMap = blockMaps.trafficDensityMap;

  for (var x = 0, width = trafficDensityMap.width; x < width; x++) {
    for (var y = 0, height = trafficDensityMap.height; y < height; y++) {
      var trafficDensity = trafficDensityMap.get(x, y);
      if (trafficDensity === 0)
        continue;

      if (trafficDensity <= 24)
        trafficDensity = 0;
      else if (trafficDensity > 200)
        trafficDensity = trafficDensity - 34;
      else
        trafficDensity = trafficDensity - 24;

      trafficDensityMap.set(x, y, trafficDensity);
    }
  }
};


// Given a tileValue, score it on the pollution it generates, in the range 0-255
// industryPollution (PhaiCity, src/provinceRules.ts): how much more or less the factories smoke in this province
// shopRubbish (PhaiCity, src/tourism.ts): pollution from visitors' rubbish on each shop tile.
// plantPollution(x, y, tileValue) (PhaiCity, src/powerPlants.ts): a power plant tile's pollution by its kind
var getPollutionValue = function(tileValue, industryPollution, shopRubbish, plantPollution, x, y) {
  if (tileValue < TileValues.POWERBASE) {
    // Roads, fires and radiation lie below POWERBASE

    // Heavy traffic is bad
    if (tileValue >= TileValues.HTRFBASE)
      return 75;

    // Low traffic not so much
    if (tileValue >= TileValues.LTRFBASE)
      return 50;

    if (tileValue <  TileValues.ROADBASE) {
      // Fire = carbon monoxide = a bad score for you
      if (tileValue > TileValues.FIREBASE)
        return 90;

      // Radiation. Top of the charts.
      if (tileValue >= TileValues.RADTILE)
        return 255;
    }

    // All other types of ground are pure.
    return 0;
  }

  // If we've reached this point, we're classifying some form of zone tile

  // Residential and commercial zones don't pollute, but for visitors' rubbish in the shops
  if (tileValue >= TileValues.COMBASE && tileValue < TileValues.INDBASE)
    return shopRubbish || 0;

  if (tileValue <= TileValues.LASTIND)
    return 0;

  // Industrial zones, however...
  if (tileValue < TileValues.PORTBASE)
    return Math.round(50 * industryPollution);

  // Coal power plants are bad (PhaiCity: and the other kinds less so, or not at all)
  if (tileValue <= TileValues.LASTPOWERPLANT)
      return plantPollution && tileValue >= TileValues.COALBASE ? plantPollution(x, y, tileValue) : 100;

  // PhaiCity: so are the plants that take only the tiles their model covers, by their kind (src/plantBlocks.ts)
  if (tileValue >= TileValues.PLANT3_BASE && tileValue <= TileValues.PLANT3_LAST ||
      tileValue >= TileValues.PLANT2_BASE && tileValue <= TileValues.PLANT2_LAST)
    return plantPollution ? plantPollution(x, y, tileValue) : 100;

  return 0;
};


// PhaiCity: on a map at real scale (16 m tiles, docs/CITY_SCALE.md) the distance counts in steps of about this many metres,
// an original tile's worth, so a town's land is worth less only some 3 km from its centre rather than 1 km (owner,
// 15 Oct 2026: "แก้ราคาที่ดินต่ำ ให้บ้านกับร้านค้าโตได้สูงขึ้น": the middle of a town of 5,000 counted as its edge)
var NEARNESS_STEP_M = 48;
var centreDistanceStep = function(map) {
  var metres = map.tileSizeM;
  return metres && isCityTileSize(metres) ? Math.max(1, Math.round(NEARNESS_STEP_M / metres)) : 1;
};


// Compute the Manhattan distance of the given point from the city centre, and force into the range 0-64
// PhaiCity: on a real-scale city map, the straight-line distance (docs/NO_GRID_PLAN.md 4.2): a neighbourhood off the
// centre's diagonal was worth less than one as far along a street north or east of it, as the Manhattan distance
// counts a diagonal mile as 1.4 (Math.sqrt is exact in every JS engine, so every machine gets the same city)
var getCityCentreDistance = function(map, x, y) {
  var xDis, yDis;

  if (x > map.cityCentreX)
    xDis = x - map.cityCentreX;
  else
    xDis = map.cityCentreX - x;

  if (y > map.cityCentreY)
    yDis = y - map.cityCentreY;
  else
    yDis = map.cityCentreY - y;

  var distance = isCityTileSize(map.tileSizeM) ? Math.floor(Math.sqrt(xDis * xDis + yDis * yDis)) : xDis + yDis;
  return Math.min(Math.floor(distance / centreDistanceStep(map)), 64);
};

// PhaiCity: where a block is measured from: its middle on a real-scale city map (docs/NO_GRID_PLAN.md 4.2), else its
// top-left tile as the original did
var blockMiddle = function(map, size) {
  return isCityTileSize(map.tileSizeM) ? size >> 1 : 0;
};


// This monster function fills up the landValueMap, the terrainDensityMap and the pollutionDensityMap based
// on values found by iterating over the map.
//
// Factors that affect land value:
//   * Distance from the city centre
//   * High crime
//   * High pollution
//   * Proximity to undeveloped terrain (who doesn't love a good view?)
//
// Pollution is completely determined by the tile types in the block
// extraPollution(x, y, tileValue) (PhaiCity, src/mining.ts): a mine's dust and the poison in the ground
// extraLandValue(x, y) (PhaiCity, src/rulerHouse.ts): what the ruler's house adds to the land near it
// wind (PhaiCity, src/wind.ts): the month's wind, which carries the smoke on a real-scale city map
// (src/sim/pollutionField.ts, docs/NO_GRID_PLAN.md 4.1)
var pollutionTerrainLandValueScan = function(map, census, blockMaps, industryPollution, shopRubbish, plantPollution,
                                             extraPollution, extraLandValue, wind) {
  if (industryPollution === undefined)
    industryPollution = 1;
  var landCover = map.landCover || null;
  // PhaiCity: on a real-scale city map each polluting tile is a source in metres whose plume drifts with the wind, not
  // a share of its block's sum smoothed twice into square blocks (src/sim/pollutionField.ts)
  var metric = isCityTileSize(map.tileSizeM);
  var sources = metric ? [] : null;

  // We record raw pollution readings for each tile into tempMap1, and then use tempMap2 and tempMap1 to smooth
  // out the pollution in order to construct the new values for the populationDensityMap
  var tempMap1 = blockMaps.tempMap1;
  var tempMap2 = blockMaps.tempMap2;

  // tempMap3 will be used to record raw terrain information, i.e. if the the land is developed. This will be
  // smoothed in to terrainDensityMap later
  var tempMap3 = blockMaps.tempMap3;
  tempMap3.clear();

  var landValueMap = blockMaps.landValueMap;
  var terrainDensityMap = blockMaps.terrainDensityMap;
  var pollutionDensityMap = blockMaps.pollutionDensityMap;
  var crimeRateMap = blockMaps.crimeRateMap;

  var x, y, width, height;

  var totalLandValue = 0;
  var developedTileCount = 0;

  for (x = 0, width = landValueMap.width; x < width; x++) {
    for (y = 0, height = landValueMap.height; y < height; y++) {
      var pollutionLevel = 0;
      var developed = false;

      // The land value map has a chunk size of 2
      var worldX = x * 2;
      var worldY = y * 2;

      for (var mapX = worldX; mapX <= worldX + 1; mapX++) {
        for (var mapY = worldY; mapY <= worldY + 1; mapY++) {
          // A map an odd number of tiles across (a whole district's) ends halfway through its last blocks
          if (mapX >= map.width || mapY >= map.height)
            continue;

          var tileValue = map.getTileValue(mapX, mapY);

          if (tileValue === TileValues.DIRT) {
            // PhaiCity: on a real map, bare land the map knows is paddy, field, orchard, grass or wetland is open land
            // as woods and water are, and makes the land beside it worth more (owner, 15 Oct 2026: "แก้ราคาที่ดินต่ำ
            // ให้บ้านกับร้านค้าโตได้สูงขึ้น": round Khon Kaen it was all plain ground, so no block had any of it)
            if (landCover && OPEN_COVER[landCover[mapY * map.width + mapX]])
              tempMap3.worldSet(mapX, mapY, tempMap3.worldGet(mapX, mapY) + 15);
            continue;
          }

          if (tileValue < TileValues.RUBBLE) {
            // Undeveloped land: record in tempMap3. Each undeveloped piece of land scores 15.
            // tempMap3 has a chunk size of 4, so each square in tempMap3 will ultimately contain a
            // maximum value of 240
            var terrainValue = tempMap3.worldGet(mapX, mapY);
            tempMap3.worldSet(mapX, mapY, terrainValue + 15);
            continue;
          }

          var tilePollution = getPollutionValue(tileValue, industryPollution, shopRubbish, plantPollution, mapX, mapY);
          if (extraPollution)
            tilePollution += extraPollution(mapX, mapY, tileValue);
          if (sources !== null) {
            if (tilePollution > 0)
              sources.push([mapY * map.width + mapX, tilePollution]);
          } else {
            pollutionLevel += tilePollution;
          }
          // PhaiCity: the state's roads and railways a real map starts with are not the city's land (owner, 15 Oct 2026:
          // "หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี"): a district's thousands of them far from the town made its average land
          // value, and so its taxes, a tenth of what its own blocks are worth
          if (tileValue >= TileValues.ROADBASE &&
              !(tileValue <= TileValues.LASTRAIL && map.isNationalTransport && map.isNationalTransport(mapX, mapY)))
            developed = true;
        }
      }

      // Clamp pollution in range 0-255 (at the moment it's range is 0-1020) and record it for later.
      pollutionLevel = Math.min(pollutionLevel, 255);
      tempMap1.set(x, y, pollutionLevel);

      if (developed) {
        // getCityCentreDistance returns a score in the range 0-64, so, after shifting, landValue will be in
        // range 8-136
        var middle = blockMiddle(map, 2);
        var landValue = 34 - Math.floor(getCityCentreDistance(map, worldX + middle, worldY + middle) / 2);
        landValue = landValue << 2;

        // Land in the same neighbourhood as unspoiled land is more valuable...
        landValue += terrainDensityMap.get(x >> 1, y >> 1);

        // ... and polluted land obviously is less valuable
        landValue -= pollutionDensityMap.get(x, y);

        // ... getting mugged won't help either
        if (crimeRateMap.get(x, y) > 190)
          landValue -= 20;

        // ... and living near the ruler's house (PhaiCity) helps
        if (extraLandValue)
          landValue += extraLandValue(worldX, worldY);

        // Clamp in range 1-250 (0 represents undeveloped land)
        landValue = MiscUtils.clamp(landValue, 1, 250);
        landValueMap.set(x, y, landValue);

        totalLandValue += landValue;
        developedTileCount++;
      } else {
        landValueMap.set(x, y, 0);
      }
    }
  }

  if (developedTileCount > 0)
    census.landValueAverage = Math.floor(totalLandValue / developedTileCount);
  else
    census.landValueAverage = 0;
    
  if (sources !== null) {
    // PhaiCity: the plumes, each block's middle the sum of those over it (src/sim/pollutionField.ts)
    var field = pollutionField(map.width, map.height, map.tileSizeM, tempMap1.blockSize, sources, wind);
    for (x = 0, width = tempMap1.width; x < width; x++)
      for (y = 0, height = tempMap1.height; y < height; y++)
        tempMap1.set(x, y, field[y * width + x]);
  } else {
    // Smooth the pollution map twice
    smoothMap(tempMap1, tempMap2, SMOOTH_ALL_THEN_CLAMP);
    smoothMap(tempMap2, tempMap1, SMOOTH_ALL_THEN_CLAMP);
  }

  var maxPollution = 0;
  var pollutedTileCount = 0;
  var totalPollution = 0;

  // We iterate over the now-smoothed pollution map rather than using the block map's copy routines
  // so that we can compute the average and total pollution en-route
  for (x = 0, width = map.width; x < width; x += pollutionDensityMap.blockSize) {
    for (y = 0, height = map.height; y < height; y += pollutionDensityMap.blockSize)  {
      // Copy the values into pollutionDensityMap
      var pollution = tempMap1.worldGet(x, y);
      pollutionDensityMap.worldSet(x, y, pollution);

      if (pollution !== 0) {
        pollutedTileCount++;
        totalPollution += pollution;

        // Note the most polluted location: any monsters will be drawn there (randomly choosing one
        // if we have multiple competitors for most polluted)
        if (pollution > maxPollution || (pollution === maxPollution && Random.getChance(3))) {
          maxPollution = pollution;
          map.pollutionMaxX = x;
          map.pollutionMaxY = y;
        }
      }
    }
  }

  if (pollutedTileCount)
    census.pollutionAverage = Math.floor(totalPollution / pollutedTileCount);
  else
    census.pollutionAverage = 0;

  smoothMap(tempMap3, terrainDensityMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
};


// Computes the coverage radius of police stations, and scores each neighbourhood in the map on its crime rate.
// Factors that attract crime are:
//    * The zone has a low value
//    * The zone is a slum
//    * The zone is far away from those pesky police
var crimeScan = function(census, blockMaps) {
  var policeStationMap = blockMaps.policeStationMap;
  var policeStationEffectMap = blockMaps.policeStationEffectMap;
  var crimeRateMap = blockMaps.crimeRateMap;
  var landValueMap = blockMaps.landValueMap;
  var populationDensityMap = blockMaps.populationDensityMap;

  smoothMap(policeStationMap, policeStationEffectMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
  smoothMap(policeStationEffectMap, policeStationMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
  smoothMap(policeStationMap, policeStationEffectMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);

  var totalCrime = 0;
  var crimeZoneCount = 0;

  // Scan the map, looking for developed land, as it can attract crime.
  for (var x = 0, width = crimeRateMap.mapWidth, blockSize = crimeRateMap.blockSize; x < width; x += blockSize) {
    for (var y = 0, height = crimeRateMap.mapHeight, b; y < height; y += blockSize) {
      // Remember: landValueMap values are in the range 0-250
      var value = landValueMap.worldGet(x, y);

      if (value > 0) {
        crimeZoneCount += 1;

        // Force value in the range -122 to 128. Lower valued pieces of land attract more crime.
        value = 128 - value;

        // Add population density (a value between 0 and 510). value now lies in range -260 - 382.
        // Denser areas attract more crime.
        value += populationDensityMap.worldGet(x, y);

        // Clamp in range -260 to 300
        value = Math.min(value, 300);

        // If the police are nearby, there's no point committing the crime of the century
        value -= policeStationMap.worldGet(x, y);

        // Force in to range 0-250
        value = MiscUtils.clamp(value, 0, 250);

        crimeRateMap.worldSet(x, y, value);
        totalCrime += value;
      } else {
        crimeRateMap.worldSet(x, y, 0);
      }
    }
  }

  if (crimeZoneCount > 0)
      census.crimeAverage = Math.floor(totalCrime / crimeZoneCount);
  else
      census.crimeAverage = 0;
};


// Iterate over the map, and score each neighbourhood on its distance from the city centre. Scores are in the range
// -64 to 64. This affects the growth of commercial zones within that neighbourhood.
var fillCityCentreDistScoreMap = function(map, blockMaps) {
  var cityCentreDistScoreMap = blockMaps.cityCentreDistScoreMap;

  for (var x = 0, width = cityCentreDistScoreMap.width; x < width; x++) {
    for (var y = 0, height = cityCentreDistScoreMap.height; y < height; y++) {
      // First, we compute the Manhattan distance of the top-left hand corner of the neighbourhood to the city centre
      // and half that value. This leaves us a value in the range 0 - 32
      var middle = blockMiddle(map, 8);
      var value = Math.floor(getCityCentreDistance(map, x * 8 + middle, y * 8 + middle) / 2);
      // Now, we scale up by a factor of 4. We're in the range 0 - 128
      value = value * 4;
      // And finally, subtract from 64, leaving us a score in the range -64 to 64
      value = 64 - value;
      cityCentreDistScoreMap.set(x, y, value);
    }
  }
};


// Dispatch to the correct zone type to get the population value for that zone
var getPopulationDensity = function(map, x, y, tile) {
  if (tile < TileValues.COMBASE)
    return Residential.getZonePopulation(map, x, y, tile);

  if (tile < TileValues.INDBASE)
    return Commercial.getZonePopulation(map, x, y, tile) * 8;

  if (tile < TileValues.PORTBASE)
    return Industrial.getZonePopulation(map, x, y, tile) * 8;

  return 0;
};


// Iterate over the map, examining each zone for population. We then smooth the results into a population density
// map, which is used when deciding to grow residential zones. At the same time, we also note the most populous area
// (in terms of zones) to calculate our city centre. Finally, we score each area of the map on its distance from the
// city centre.
// centre (PhaiCity, src/rulerHouse.ts): the ruler's house, which is the city's centre while it stands
var populationDensityScan = function(map, blockMaps, centre) {
  // We will build the initial unsmoothed map in tempMap1, and smooth it in to tempMap2
  var tempMap1 = blockMaps.tempMap1;
  var tempMap2 = blockMaps.tempMap2;
  var populationDensityMap = blockMaps.populationDensityMap;

  // We will sum all the coordinates that contain zones into xTot and yTot. They are used in our city centre
  // heuristic.
  var xTot = 0;
  var yTot = 0;
  var zoneTotal = 0;
  // PhaiCity: on a map with painted zones the plots add up within each block (src/plots.ts)
  var painted = map.paintedZones === true;

  tempMap1.clear();

  for (var x = 0, width = map.width; x < width; x++) {
    for (var y = 0, height = map.height; y < height; y++) {
      var tile = map.getTile(x, y);
      if (tile.isZone()) {
        var tileValue = tile.getValue();

        // Ask the zone to calculate its population, scale it up, then clamp in the range 0-254
        var population = getPopulationDensity(map, x, y, tileValue) * 8;
        population = Math.min(population, 254);

        // The block size of population density is 2x2, so there can only be 1 zone per block
        tempMap1.worldSet(x, y, population);

        xTot += x;
        yTot += y;
        zoneTotal++;
      } else if (painted) {
        var density = plotDensity(map, x, y);
        if (density > 0) {
          tempMap1.worldSet(x, y, Math.min(254, tempMap1.worldGet(x, y) + density));
          xTot += x;
          yTot += y;
          zoneTotal++;
        }
      }
    }
  }

  smoothMap(tempMap1, tempMap2, SMOOTH_ALL_THEN_CLAMP);
  smoothMap(tempMap2, tempMap1, SMOOTH_ALL_THEN_CLAMP);
  smoothMap(tempMap1, tempMap2, SMOOTH_ALL_THEN_CLAMP);
  blockMaps.populationDensityMap.copyFrom(tempMap2, function(x) {return x * 2;});

  // XXX This follows the original Micropolis source, but it feels weird to me that we score the entire map
  // based on city centre proximity, and then potentially move the city centre. I think these should be
  // swapped.
  fillCityCentreDistScoreMap(map, blockMaps);

  // Compute new city centre
  if (centre) {
    map.cityCentreX = centre.x;
    map.cityCentreY = centre.y;
  } else if (zoneTotal > 0) {
    map.cityCentreX = Math.floor(xTot / zoneTotal);
    map.cityCentreY = Math.floor(yTot / zoneTotal);
  } else {
    map.cityCentreX = Math.floor(map.width / 2);
    map.cityCentreY = Math.floor(map.height / 2);
  }
};


// Compute the radius of coverage for the firestations found during the map scan
var fireAnalysis = function(blockMaps) {
  var fireStationMap = blockMaps.fireStationMap;
  var fireStationEffectMap = blockMaps.fireStationEffectMap;

  smoothMap(fireStationMap, fireStationEffectMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
  smoothMap(fireStationEffectMap, fireStationMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
  smoothMap(fireStationMap, fireStationEffectMap, SMOOTH_NEIGHBOURS_THEN_BLOCK);
};


var BlockMapUtils = {
  crimeScan: crimeScan,
  fireAnalysis: fireAnalysis,
  neutraliseRateOfGrowthMap: neutraliseRateOfGrowthMap,
  neutraliseTrafficMap: neutraliseTrafficMap,
  pollutionTerrainLandValueScan: pollutionTerrainLandValueScan,
  populationDensityScan: populationDensityScan,
  // PhaiCity: the tiles in one step of distance from the centre on this map (1, or 3 on a city map at real scale)
  nearnessStep: centreDistanceStep,
  // PhaiCity: a point's distance from the centre in those steps, 0-64 (straight on a real-scale city map)
  centreDistance: getCityCentreDistance
};


export { BlockMapUtils };
