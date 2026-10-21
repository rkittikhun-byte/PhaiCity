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
import { BlockMapUtils } from './blockMapUtils.js';
import { Budget } from './budget.js';
import { Census } from './census.js';
import { Commercial } from './commercial.js';
import { DisasterManager } from './disasterManager.js';
import { EventEmitter } from './eventEmitter.js';
import { EmergencyServices } from './emergencyServices.js';
import { Evaluation } from './evaluation.js';
import { Industrial } from './industrial.js';
import { MapScanner } from './mapScanner.js';
import * as Messages from './messages.ts';
import { MiscTiles } from './miscTiles.js';
import { MiscUtils } from './miscUtils.js';
import { PowerManager } from './powerManager.js';
import { chancePerCycle, DEFAULT_CLIMATE, DEFAULT_RULES, seasonalRisks } from './provinceRules.ts';
import { plantPollution, powerKindAt } from './powerPlants.ts';
import { BUS_STOP, CIVIC, COALBASE, FARM, HARBOUR, MINE, STATION, WASTE } from './tileValues.ts';
import { Transit } from './transit.ts';
import {
  CULTURE_VISITORS, cultureNoise, GRANARY_DROUGHT_FACTOR, hasWing, HOUSE_KIND, houseLandValue, houseStanding,
  houseUpkeep, TREASURY_TAX_BONUS, WARNING_RISK_FACTOR
} from './rulerHouse.ts';
import {
  familyPull, NO_SERVICES, peopleOf, pollutionShield, serviceLevels, Services, skilled, SKILLED_SMOKE, WARN_FROM
} from './services.ts';
import { Mining } from './mining.ts';
import { SEWAGE_AWAY, SEWAGE_DIRT, Waste, WASTE_FROM } from './waste.ts';
import {
  CLOSED_MONTHS, GREEN_DEMAND, GREEN_LAND_VALUE, GREEN_RECHARGE, hasPolicy, POLLUTION_TAX_DEMAND, POLLUTION_TAX_RATE,
  POLLUTION_TAX_SMOKE, policyUpkeep, SONGKRAN_VISITORS, TOLL_RAISE, TOLL_SHOPS, WATER_SAVING, WATER_SAVING_PULL
} from './policies.ts';
import { BURNING_MONTHS, FACTORIES_PER_FARM, Farming, SHOPS_PER_HARBOUR } from './farming.ts';
import { isFieldValue } from './farmZone.ts';
import { FARM_ZONE } from './provinceRules.ts';
import { isRoadTile, roadLevelAt, roadSpec, tollsThisMonth } from './roadLevels.ts';
import { canalLandValues, growCanals } from './canals.ts';
import { Random } from './random.ts';
import { RepairManager } from './repairManager.js';
import { Residential } from './residential.js';
import { Road } from './road.js';
import { SpriteManager } from './spriteManager.js';
import { Stadia } from './stadia.js';
import { festivalWaterUse, livingCostFactor, NO_TOURISM, shopRubbish, tourismMonth, touristTrips } from './tourism.ts';
import { calendarOf, festivalLandValue, festivalsRun, festivalTraffic, festivalVisits, festivalWaste } from './festivals.ts';
import { Traffic } from './traffic.js';
import { Transport } from './transport.js';
import { Valves } from './valves.js';
import { nextWeather, startingWeather, weatherTraffic, weatherVisitors } from './weather.ts';
import { spellBeginning, stormDuring } from './rainSpells.ts';
import { NO_DROUGHT, WaterManager } from './waterManager.ts';

// rules (PhaiCity): the province's rules (src/provinceRules.ts resolveRules); none means the game's own.
// resources (PhaiCity): the province's resource levels, 0–5 by id (src/geo/provinceResources.ts); none for a
// practice map
var Simulation = EventEmitter(function (gameMap, gameLevel, speed, savedGame, rules, resources) {
  this._map = gameMap;
  this.rules = rules || DEFAULT_RULES;
  this.resources = resources || {};
  // This month's visitors (src/tourism.ts) and the months since the news last heard of them staying away
  this._tourism = NO_TOURISM;
  this._monthsSinceTouristWarning = 12;
  // The pollution on each tile of a power plant, by the kind built there (src/powerPlants.ts)
  var map = gameMap;
  this._extraPollution = function(x, y, tileValue) {
    // ... and the dust or noise of a road by its level (src/roadLevels.ts)
    var road = isRoadTile(tileValue) ? roadSpec(roadLevelAt(map, x, y)).noise : 0;
    // ... and a festival at the ruler's house's culture court (src/rulerHouse.ts)
    var festival = this._festivalHouse ? cultureNoise(this._festivalHouse, x, y) : 0;
    // ... and the smoke and smell of the rubbish buildings, and rubbish nobody takes in the streets (src/waste.ts)
    // ... and the high-speed rail station's noise (src/transit.ts)
    return this._mining.pollutionAt(map, x, y, tileValue) + this._farming.hazeAt(x, y) + road + festival +
           this._waste.pollutionAt(map, x, y, tileValue) + this._transit.pollutionAt(map, x, y, tileValue);
  }.bind(this);
  // The ruler's house, while a festival's month makes noise at its culture court (set before each pollution scan)
  this._festivalHouse = null;
  this._plantPollution = function(x, y, tileValue) {
    var index = tileValue - COALBASE;
    var centreX = x - (index % 4) + 1;
    var centreY = y - Math.floor(index / 4) + 1;
    return plantPollution(powerKindAt(map.powerKinds, centreY * map.width + centreX));
  };
  this.setLevel(gameLevel);
  this.setSpeed(speed);

  this._phaseCycle = 0;
  this._simCycle = 0;
  this._cityTime = 0;
  this._cityPopLast = 0;
  this._messageLast = undefined;
  this._startingYear = 1900;

  // Last date sent to front end
  this._cityYearLast = -1;
  this._cityMonthLast = -1;

  // Last time we relayed a message from PowerManager to the front-end
  this._lastPowerMessage = null;
  // ... and from the water supply (PhaiCity, src/waterManager.ts)
  this._lastWaterMessage = null;

  // And now, the main cast of characters
  this.evaluation = new Evaluation(this._gameLevel);
  this._valves = new Valves();
  this.budget = new Budget();
  this._census = new Census();
  this._powerManager = new PowerManager(this._map);
  this._waterManager = new WaterManager(this._map);
  this.spriteManager = new SpriteManager(this._map);
  this._mapScanner = new MapScanner(this._map);
  this._repairManager = new RepairManager(this._map);
  this._traffic = new Traffic(this._map, this.spriteManager);
  this.disasterManager = new DisasterManager(this._map, this.spriteManager, this._gameLevel);
  this._valves.demand = this.rules.demand;
  this._powerManager.outputFactor = this.rules.powerPlantOutput;
  this._powerManager.resources = this.resources;
  this._powerManager.drySeason = this.rules.drought || null;
  // PhaiCity: the province's mines: its ore, the poisoned ground (src/mining.ts)
  this._mining = new Mining(this._map.width, this._map.height, this.resources);
  this._monthsSinceToxicWarning = 12;
  // ... and its farms and fishing harbours (src/farming.ts)
  this._farming = new Farming(this._map.width, this._map.height, this.resources);
  // ... with its farm zone's numbers (src/farmZone.ts)
  this._farming.fields.spec = this.rules.farmZone || FARM_ZONE;
  this._monthsSinceHazeWarning = 12;
  this._monthsSinceDirtyWarning = 12;
  this._waterManager.drought = this.rules.drought || NO_DROUGHT;
  // ... and the ruler's house (src/rulerHouse.ts): whether one stood at the last month's end
  this._houseStood = houseStanding(this._map);
  // ... and the schools and hospitals (src/services.ts): their levels last month, and the months since the news heard
  // of too few
  this._services = new Services();
  this._serviceLevels = NO_SERVICES;
  this._monthsSinceSchoolWarning = 12;
  this._monthsSinceHospitalWarning = 12;
  // ... and the rubbish and wastewater (src/waste.ts), and the months since the news last heard of them
  this._waste = new Waste(this._map.width, this._map.height);
  this._monthsSinceRubbishWarning = 12;
  this._monthsSinceSewageWarning = 12;
  // ... and public transport (src/transit.ts), whose reach the zones' trips read (src/traffic.js)
  this._transit = new Transit(this._map.width, this._map.height);
  this._traffic.transit = this._transit;

  this.blockMaps = {
    // Holds a "distance score" for the block from the city centre, range  -64 to 64
    cityCentreDistScoreMap: new BlockMap(this._map.width, this._map.height, 8),

    // Holds a score representing how dangerous an area is, in range 0-250 (larger is worse)
    crimeRateMap: new BlockMap(this._map.width, this._map.height, 2),

    // A map used to note positions of fire stations during the map scan, range 0-1000
    fireStationMap: new BlockMap(this._map.width, this._map.height, 8),

    // Holds a value containing a score representing the effect of fire cover in this neighborhood, range 0-1000
    fireStationEffectMap: new BlockMap(this._map.width, this._map.height, 8),

    // Holds scores representing the land value in the range 0-250
    landValueMap: new BlockMap(this._map.width, this._map.height, 2),

    // A map used to note positions of police stations during the map scan, range 0-1000
    policeStationMap: new BlockMap(this._map.width, this._map.height, 8),

    // Holds a value containing a score representing how much crime is dampened in this block, range 0-1000
    policeStationEffectMap: new BlockMap(this._map.width, this._map.height, 8),

    // Holds a value representing the amount of pollution in a neighbourhood, in the range 0-255
    pollutionDensityMap: new BlockMap(this._map.width, this._map.height, 2),

    // Holds a value representing population density of a block, in the range 0-510
    populationDensityMap: new BlockMap(this._map.width, this._map.height, 2),

    // Holds a value representing the rate of growth of a neighbourhood in the range -200 to +200
    rateOfGrowthMap: new BlockMap(this._map.width, this._map.height, 8),

    // Scores a block on how undeveloped/unspoilt it is, range 0-240
    terrainDensityMap: new BlockMap(this._map.width, this._map.height, 4),

    // Scores the volume of traffic in this cluster, range 0-240
    trafficDensityMap: new BlockMap(this._map.width, this._map.height, 2),

    // Temporary maps
    tempMap1: new BlockMap(this._map.width, this._map.height, 2),
    tempMap2: new BlockMap(this._map.width, this._map.height, 2),
    tempMap3: new BlockMap(this._map.width, this._map.height, 4),

    // PhaiCity: the water supply as last scanned and the groundwater, read only (the city map's water layers)
    water: this._waterManager.view,

    // PhaiCity: the poison in the ground from mines, 0-255, read only (the city map's toxic layer)
    toxicMap: {worldGet: function(x, y) { return this._mining.ground[y * this._map.width + x]; }.bind(this)}
  };

  this._clearCensus();

  if (savedGame) {
    this.load(savedGame);
  } else {
    this.budget.setFunds(20000);
    this._census.totalPop = 1;
  }

  // The ground's water comes from the land as it is now (and its heights on a province map); a save brings what
  // the city has pumped from it. Renderers read the water supply through the map, never write it.
  this._waterManager.prepareGround(this._map.heights || null);
  this._mining.start(this.resources);
  this._waterManager.poison = this._mining;
  this._map.water = this._waterManager.view;
  // ... and what the canals add to the land value (src/canals.ts), until their next month works it out again
  this._canalLand = canalLandValues(this._map);
  this._canalLandVersion = this._map.canalsVersion;
  // ... and the month's weather (src/weather.ts): a saved city's, or a new city's first, from the likeliest of its month,
  // with its own stream of chances seeded from the city's (read, not drawn, so no other chance shifts)
  if (!this._map.weather)
    this._map.weather = startingWeather(this._climate(), this.getDate().month, Random.getState(), this._cityTime >> 2);
  this._traffic.weatherLoad = weatherTraffic(this._map.weather);
  this._waterManager.weather = this._map.weather;
  // The months since it last rained, for the news of the year's first rains (not saved: only the news hears it)
  this._dryMonths = 0;

  this.init();
});


Simulation.prototype.setLevel = function(l) {
  if (l !== Simulation.LEVEL_EASY &&
      l !== Simulation.LEVEL_MED &&
      l !== Simulation.LEVEL_HARD)
    throw new Error('Invalid level!');

  this._gameLevel = l;
};


Simulation.prototype.setSpeed = function(s) {
  if (s !== Simulation.SPEED_PAUSED &&
      s !== Simulation.SPEED_SLOW &&
      s !== Simulation.SPEED_MED &&
      s !== Simulation.SPEED_FAST)
    throw new Error('Invalid speed!');

  this._speed = s;
};


Simulation.prototype.isPaused = function() {
  return this._speed === Simulation.SPEED_PAUSED;
};


var saveProps = ['_cityTime', '_speed', '_gameLevel'];

Simulation.prototype.save = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    saveData[saveProps[i]] = this[saveProps[i]];

  this._map.save(saveData);
  this.evaluation.save(saveData);
  this._valves.save(saveData);
  this.budget.save(saveData);
  this._census.save(saveData);
  this._waterManager.save(saveData);
  this._mining.save(saveData);
  this._farming.save(saveData);
  this._waste.save(saveData);
  // The random generator carries on where it was, so a loaded city goes on as the saved one would have
  saveData.randomState = Random.getState();
};


Simulation.prototype.load = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    this[saveProps[i]] = saveData[saveProps[i]];
  // PhaiCity: the saved level is the city's mode for good (src/gameModes.ts): the disasters and the evaluation, made
  // before the save was read, take it too
  this.disasterManager._gameLevel = this._gameLevel;
  this.evaluation.gameLevel = '' + this._gameLevel;

  this._map.load(saveData);
  this.evaluation.load(saveData);
  this._valves.load(saveData);
  this.budget.load(saveData);
  this._census.load(saveData);
  this._waterManager.load(saveData);
  this._mining.load(saveData);
  this._farming.load(saveData);
  this._waste.load(saveData);
  Random.setState(saveData.randomState);
};


Simulation.prototype.simTick = function() {
  this._simFrame();
  this._updateTime();
  // TODO Graphs
};


Simulation.prototype._simFrame = function() {
  if (this.budget.awaitingValues)
    return;

  // Default to slow speed
  var threshold = 100;

  switch (this._speed) {
    case Simulation.SPEED_PAUSED:
      return;

    case Simulation.SPEED_SLOW:
      // We've already set the threshold correctly
      break;

    case Simulation.SPEED_MED:
      threshold = 50;
      break;

    case Simulation.SPEED_FAST:
      threshold = 10;
      break;

    default:
      console.warn('Unexpected speed ('  + this._speed + '): defaulting to slow');
  }

  var d = new Date();
  if (d - this._lastTickTime < threshold)
    return;

  var simData = this._constructSimData();
  this._simulate(simData);
  this._lastTickTime = new Date();
};


Simulation.prototype._clearCensus = function() {
  // The cycle's stops and stations reach the next cycle's trips (src/transit.ts)
  this._transit.endCycle();
  this._census.clearCensus();
  // PhaiCity: each bus on a road works as a stop did, reaching further (src/busStopTool.ts); its upkeep goes in this
  // cycle's census, as the stations found on the map do
  var buses = this._map.buses || [];
  for (var b = 0; b < buses.length; b++) {
    var bx = buses[b] % this._map.width, by = Math.floor(buses[b] / this._map.width);
    if (this._map.testBounds(bx, by) && isRoadTile(this._map.getTileValue(bx, by)))
      this._transit.stopFound(bx, by, this._census, true);
  }
  this._powerManager.clearPowerStack();
  this._waterManager.clearCycle();
  this._mining.clearCycle();
  this._farming.clearCycle();
  this._services.clearCycle();
  this._waste.clearCycle();
  this.blockMaps.fireStationMap.clear();
  this.blockMaps.policeStationMap.clear();
};


Simulation.prototype._constructSimData = function() {
  return {
    blockMaps: this.blockMaps,
    budget: this.budget,
    census: this._census,
    cityTime: this._cityTime,
    disasterManager: this.disasterManager,
    gameLevel: this._gameLevel,
    repairManager: this._repairManager,
    powerManager: this._powerManager,
    waterManager: this._waterManager,
    simulator: this,
    // PhaiCity: how much of pollution's harm to homes health takes away (src/services.ts, src/residential.js)
    pollutionShield: pollutionShield(this._serviceLevels),
    touristTrips: touristTrips(this._tourism),
    spriteManager: this.spriteManager,
    trafficManager: this._traffic,
    valves: this._valves
  };
};


Simulation.prototype.init = function() {
  this._lastTickTime = -1;

  // Add various listeners that we will in turn transmit upwards
  var evaluationEvents = ['CLASSIFICATION_UPDATED', 'POPULATION_UPDATED', 'SCORE_UPDATED'].map(function(m) {
    return Messages[m];
  });
  for (var i = 0, l = evaluationEvents.length; i < l; i++)
    this.evaluation.addEventListener(evaluationEvents[i], MiscUtils.reflectEvent.bind(this, evaluationEvents[i]));

  this._powerManager.addEventListener(Messages.NOT_ENOUGH_POWER, function(e) {
    var d = new Date();

    if (this._lastPowerMessage === null || d - this._lastPowerMessage > 1000 * 60 * 2) {
      this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NOT_ENOUGH_POWER});
      this._lastPowerMessage = d;
    }
  }.bind(this));

  this._waterManager.addEventListener(Messages.NOT_ENOUGH_WATER, function() {
    var d = new Date();

    if (this._lastWaterMessage === null || d - this._lastWaterMessage > 1000 * 60 * 2) {
      this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NOT_ENOUGH_WATER});
      this._lastWaterMessage = d;
    }
  }.bind(this));
  this._waterManager.addEventListener(Messages.GROUNDWATER_LOW, this._wrapMessage.bind(this, Messages.GROUNDWATER_LOW));

  this.budget.addEventListener(Messages.FUNDS_CHANGED, MiscUtils.reflectEvent.bind(this, Messages.FUNDS_CHANGED));
  this.budget.addEventListener(Messages.BUDGET_NEEDED, MiscUtils.reflectEvent.bind(this, Messages.BUDGET_NEEDED));
  this.budget.addEventListener(Messages.NO_MONEY, this._wrapMessage.bind(this, Messages.NO_MONEY));

  this._valves.addEventListener(Messages.VALVES_UPDATED, this._onValveChange.bind(this));

  for (i = 0, l = Messages.DISASTER_MESSAGES.length; i < l; i++) {
    this.spriteManager.addEventListener(Messages.DISASTER_MESSAGES[i], this._wrapMessage.bind(this, Messages.DISASTER_MESSAGES[i]));
    this.disasterManager.addEventListener(Messages.DISASTER_MESSAGES[i], this._wrapMessage.bind(this, Messages.DISASTER_MESSAGES[i]));
  }
  for (i = 0, l = Messages.CRASHES.length; i < l; i++)
    this.spriteManager.addEventListener(Messages.CRASHES[i], this._wrapMessage.bind(this, Messages.CRASHES[i]));

  this.spriteManager.addEventListener(Messages.HEAVY_TRAFFIC, this._wrapMessage.bind(this, Messages.HEAVY_TRAFFIC));

  // Register actions
  Commercial.registerHandlers(this._mapScanner, this._repairManager);
  EmergencyServices.registerHandlers(this._mapScanner, this._repairManager);
  Industrial.registerHandlers(this._mapScanner, this._repairManager);
  MiscTiles.registerHandlers(this._mapScanner, this._repairManager);
  this._powerManager.registerHandlers(this._mapScanner, this._repairManager);
  this._waterManager.registerHandlers(this._mapScanner, this._repairManager);
  this._mapScanner.addAction(MINE, this._mining.mineFound.bind(this._mining));
  this._repairManager.addAction(MINE, 15, 3);
  this._mapScanner.addAction(FARM, this._farming.farmFound.bind(this._farming));
  this._mapScanner.addAction(HARBOUR, this._farming.harbourFound.bind(this._farming));
  // ... and the farm zone's fields (src/farmZone.ts)
  this._mapScanner.addAction(function(tile) { return isFieldValue(tile.getValue()); },
                             this._farming.fieldFound.bind(this._farming));
  this._repairManager.addAction(FARM, 15, 3);
  this._repairManager.addAction(HARBOUR, 15, 3);
  this._mapScanner.addAction(CIVIC, this._civicFound.bind(this));
  this._repairManager.addAction(CIVIC, 15, 3);
  this._mapScanner.addAction(WASTE, this._wasteFound.bind(this));
  this._repairManager.addAction(WASTE, 15, 3);
  this._mapScanner.addAction(BUS_STOP, this._busStopFound.bind(this));
  this._mapScanner.addAction(STATION, this._stationFound.bind(this));
  this._repairManager.addAction(STATION, 15, 3);
  Road.registerHandlers(this._mapScanner, this._repairManager);
  Residential.registerHandlers(this._mapScanner, this._repairManager);
  Stadia.registerHandlers(this._mapScanner, this._repairManager);
  Transport.registerHandlers(this._mapScanner, this._repairManager);

  // The zones' first scan needs the water already running, as it needs power already in the tiles
  var month = this.getDate().month;
  this._waterManager.findSources();
  this._waterManager.doWaterScan(month, false);
  this._waterManager.clearCycle();

  var simData = this._constructSimData();
  this._mapScanner.mapScan(0, this._map.width, simData);
  this._powerManager.doPowerScan(this._census);
  this._waterManager.doWaterScan(month, false);
  this._pollutionTerrainLandValueScan();
  BlockMapUtils.crimeScan(this._census, this.blockMaps);
  BlockMapUtils.populationDensityScan(this._map, this.blockMaps, this._house());
  BlockMapUtils.fireAnalysis(this.blockMaps);
  // Who would visit as the city stands, shown before the first month passes (nothing is paid for it)
  this._setTourism(this._visitors(month));
};


var speedPowerScan = [2, 4, 5];
var speedPollutionTerrainLandValueScan = [2, 7, 17];
var speedCrimeScan = [1, 8, 18];
var speedPopulationDensityScan = [1, 9,19];
var speedFireAnalysis = [1, 10, 20];
var CENSUS_FREQUENCY_10 = 4;
var CENSUS_FREQUENCY_120 = CENSUS_FREQUENCY_10 * 10;
var TAX_FREQUENCY = 48;


var simulate = function(simData) {
  // PhaiCity: water came or went (a canal dug or filled in, src/canals.ts), so the ground's water is worked out again
  if (this._map.groundChanged) {
    this._map.groundChanged = false;
    this._waterManager.refreshGround(this._map.heights || null);
  }

  this._phaseCycle &= 15;
  var speedIndex = this._speed - 1;

  switch (this._phaseCycle)  {
    case 0:
      if (++this._simCycle > 1023)
          this._simCycle = 0;

      this._cityTime++;

      if ((this._simCycle & 1) === 0)
        this._valves.setValves(this._gameLevel, this._census, this.budget);

      this._clearCensus();
      break;

    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
      // PhaiCity: whole columns, for a map whose width is not a multiple of 8 (a whole district's)
      this._mapScanner.mapScan(Math.floor((this._phaseCycle - 1) * this._map.width / 8),
                                Math.floor(this._phaseCycle * this._map.width / 8), simData);
      break;

    case 9:
      // PhaiCity: a month's visitors, before the year's taxes take in what they spent
      if ((this._cityTime & 3) === 0) {
        // ... the month's weather first, which the rest of the month reads (src/weather.ts)
        this._weatherMonth();
        this._houseMonth();
        this._policiesMonth();
        this._servicesMonth();
        this._tourismMonth();
        this._wasteMonth();
        // ... and the high-speed rail station's trade (src/transit.ts)
        this._valves.transitTrade = this._transit.tradeFactor();
        this._miningMonth();
        this._farmingMonth();
        this._canalsMonth();
        // ... and the tollways' tolls (src/roadLevels.ts), higher by the ruler's policy
        this.budget.tollFund += tollsThisMonth(this._map, this.blockMaps.trafficDensityMap) *
                                (hasPolicy(this._map, 'higher_tolls') ? TOLL_RAISE : 1);
      }

      if (this._cityTime % CENSUS_FREQUENCY_10 === 0)
        this._census.take10Census(this.budget);

      if (this._cityTime % CENSUS_FREQUENCY_120 === 0)
        this._census.take120Census(this.budget);

      if (this._cityTime % TAX_FREQUENCY === 0)  {
        // The ruler's house's treasury takes in a little more (src/rulerHouse.ts)
        this.budget.taxBonus = hasWing(this._map, 'treasury') ? TREASURY_TAX_BONUS : 0;
        // ... and the ruler's policies cost their year, and the pollution tax takes its share (src/policies.ts)
        this.budget.policyCost = policyUpkeep(this._map);
        this.budget.pollutionTaxRate = hasPolicy(this._map, 'pollution_tax') ? POLLUTION_TAX_RATE : 0;
        this.budget.collectTax(this._gameLevel, this._census);
        this.evaluation.cityEvaluation(simData);
      }

      break;

    case 10:
      if ((this._simCycle % 5) === 0)
        BlockMapUtils.neutraliseRateOfGrowthMap(simData.blockMaps);

      BlockMapUtils.neutraliseTrafficMap(this.blockMaps);
      this._sendMessages();
      break;

    case 11:
      if ((this._simCycle % speedPowerScan[speedIndex]) === 0)
        this._powerManager.doPowerScan(this._census);
      // PhaiCity: the water every cycle (it only follows the roads), and the ground on a month's first cycle; the ruler's
      // house's granary and city tank keep half of what the dry season takes (src/rulerHouse.ts)
      this._waterManager.drought = this._drought();
      // ... and a water fee makes people save it, so it goes further (src/budget.js)
      this._waterManager.saving = (this.budget.waterFee || 0) * WATER_FEE_SAVING +
                                  (hasPolicy(this._map, 'water_saving') ? WATER_SAVING : 0);
      this._waterManager.doWaterScan(this.getDate().month, (this._cityTime & 3) === 0);
      break;

    case 12:
      if ((this._simCycle % speedPollutionTerrainLandValueScan[speedIndex]) === 0)
        this._pollutionTerrainLandValueScan();
      break;

    case 13:
      if ((this._simCycle % speedCrimeScan[speedIndex]) === 0)
        BlockMapUtils.crimeScan(this._census, this.blockMaps);
      break;

    case 14:
      // The ruler's house is the city's centre while it stands (src/rulerHouse.ts)
      if ((this._simCycle % speedPopulationDensityScan[speedIndex]) === 0)
        BlockMapUtils.populationDensityScan(this._map, this.blockMaps, this._house());
      break;

    case 15:
      if ((this._simCycle % speedFireAnalysis[speedIndex]) === 0)
        BlockMapUtils.fireAnalysis(this.blockMaps);

      this.disasterManager.doDisasters(this._census, this._seasonalRisks(this.getDate().month));
      break;
  }

  // Go on the the next phase.
  this._phaseCycle = (this._phaseCycle + 1) & 15;
};


Simulation.prototype._simulate = function(simData) {
  // This is actually a wrapper function that will only be called once, to perform the initial
  // evaluation. Once that has completed, it will supplant itself with the standard "simulate"
  // procedure defined above
  this.evaluation.cityEvaluation(simData);
  this._simulate = simulate;
  this._simulate(simData);
};


// PhaiCity: the canals grow a level every few months while they stand, by the city's people and the land value along
// them (src/canals.ts, docs/CANALS.md), and what they add to the land value nearby is worked out again when they change
Simulation.prototype._canalsMonth = function() {
  var map = this._map, landValue = this.blockMaps.landValueMap;
  var rose = growCanals(map, this._cityTime >> 2, this.evaluation.getPopulation(this._census),
                        function(x, y) { return landValue.worldGet(x, y); });
  if (rose)
    map.canalsVersion = (map.canalsVersion || 0) + 1;
  if (rose || this._canalLandVersion !== map.canalsVersion) {
    this._canalLandVersion = map.canalsVersion;
    this._canalLand = canalLandValues(map);
  }
};


// PhaiCity: the province's tourism level, 0–5
Simulation.prototype._tourismLevel = function() {
  var level = this.resources.tourism;
  return typeof level === 'number' ? level : 0;
};


// A province's city, which the country's festivals come to; not a practice map
Simulation.prototype._inProvince = function() {
  return Object.keys(this.resources).length > 0;
};


// PhaiCity: the ruler's house while it stands (src/rulerHouse.ts), or null
Simulation.prototype._house = function() {
  return houseStanding(this._map) ? this._map.rulerHouse : null;
};


// The pollution, terrain and land value scan, with what the ruler's house adds to the land near it and the noise of a
// festival at its culture court
Simulation.prototype._pollutionTerrainLandValueScan = function() {
  var house = this._house();
  this._festivalHouse = house && this._tourism.festival ? house : null;
  // Higher education makes for cleaner factories (src/services.ts)
  // ... and the ruler's pollution tax (src/policies.ts)
  var smoke = this.rules.industryPollution * (1 - SKILLED_SMOKE * skilled(this._serviceLevels)) *
              (hasPolicy(this._map, 'pollution_tax') ? POLLUTION_TAX_SMOKE : 1);
  // The ruler's green zoning adds to the land's value everywhere
  var green = hasPolicy(this._map, 'green_zoning') ? GREEN_LAND_VALUE : 0;
  // ... and the metro near its stations (src/transit.ts)
  var transit = this._transit;
  // ... and the canals by their levels (src/canals.ts)
  var canals = this._canalLand || null, width = this._map.width;
  // ... the house's reach in tiles a step of distance, longer on a map at real scale
  var step = BlockMapUtils.nearnessStep(this._map);
  // ... and the countryside round the farm zone's fields (src/farmZone.ts)
  var farmFields = this._farming.fields;
  // ... and the festivals held round the ruler's house, for a few months after (src/festivals.ts)
  var map = this._map;
  BlockMapUtils.pollutionTerrainLandValueScan(this._map, this._census, this.blockMaps, smoke,
                                              shopRubbish(this._tourism), this._plantPollution, this._extraPollution,
                                              function(x, y) {
                                                return (house ? houseLandValue(house, x, y, step) : 0) + green +
                                                       transit.landValueAt(x, y) +
                                                       (canals ? canals[y * width + x] : 0) +
                                                       farmFields.landValueAt(x, y) +
                                                       festivalLandValue(map, x, y, step);
                                              });
};


// The province's dry season, of which the ruler's house's granary and city tank keep half from the water works
Simulation.prototype._drought = function() {
  var drought = this.rules.drought || NO_DROUGHT;
  if (!hasWing(this._map, 'granary'))
    return drought;
  return {months: drought.months, share: drought.share * GRANARY_DROUGHT_FACTOR};
};


// The seasons' disasters this month (src/provinceRules.ts), rarer with the ruler's house's warning tower
Simulation.prototype._seasonalRisks = function(month) {
  var risks = seasonalRisks(this.rules, month);
  // ... and a storm spell's heavy rain this month, which floods low land beside the water (src/rainSpells.ts)
  var weather = this._map.weather, climate = this._climate(), week = (this._cityTime >> 2) * 4;
  var flood = weather && stormDuring(weather.seed, climate, week, week + 4) ? climate.flood : 0;
  if (flood > 0)
    risks = risks.concat([{disaster: 'flood', chance: chancePerCycle(flood), lowLand: true}]);
  if (!hasWing(this._map, 'warning_tower'))
    return risks;
  return risks.map(function(risk) {
    return {disaster: risk.disaster, chance: risk.chance * WARNING_RISK_FACTOR, lowLand: risk.lowLand};
  });
};


// PhaiCity: the region's and province's weather month by month (src/weather.ts), the game's own on a practice map
Simulation.prototype._climate = function() {
  return (this.rules && this.rules.weather) || DEFAULT_CLIMATE;
};


// PhaiCity: the month's weather after the last (src/weather.ts): the smoke of the city's own fields while their stubble
// burns, the traffic it slows, the rain the ground takes in this month (src/waterManager.ts), and the news of a rain
// spell beginning this month (src/rainSpells.ts): a storm, or the first rains of the year (owner, 21 Oct 2026: the news
// only with a spell)
Simulation.prototype._weatherMonth = function() {
  var month = this.getDate().month;
  var climate = this._climate();
  var previous = this._map.weather || startingWeather(climate, month, Random.getState(), this._cityTime >> 2);
  // ... the farm zone's burning fields counting as a farm for every nine (src/farmZone.ts)
  var farms = this._farming.farms.length + this._farming.fields.last.burning / FIELDS_A_FARM;
  var burning = BURNING_MONTHS.indexOf(month) >= 0 && !this._farming.noBurning ?
                Math.min(FIELD_SMOKE_MOST, farms * FIELD_SMOKE_PER_FARM) : 0;
  var weather = nextWeather(previous, climate, month, this._cityTime >> 2, burning);
  this._map.weather = weather;
  // ... and the month's festivals, which bring more cars (src/festivals.ts)
  this._traffic.weatherLoad = weatherTraffic(weather) * festivalTraffic(this._map);
  this._waterManager.weather = weather;

  var wet = weather.kind === 'rain' || weather.kind === 'storm';
  var week = (this._cityTime >> 2) * 4, spell = spellBeginning(weather.seed, climate, week, week + 4);
  if (spell && spell.storm)
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.HEAVY_STORM});
  else if (spell && this._dryMonths >= FIRST_RAINS_AFTER)
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.FIRST_RAINS});
  this._dryMonths = spell ? 0 : this._dryMonths + 1;
};


// A civic building's centre (tile 418): a school or hospital (src/services.ts), or the ruler's house, which is counted
// and pays its upkeep with its wings'
Simulation.prototype._civicFound = function(map, x, y, simData) {
  if (this._services.found(map, x, y, simData.census))
    return;
  var house = map.rulerHouse;
  if (!house || house.x !== x || house.y !== y || !map.civicKinds || map.civicKinds[y * map.width + x] !== HOUSE_KIND)
    return;
  simData.census.rulerHouseCount += 1;
  simData.census.rulerHouseUpkeep += houseUpkeep(house);
};


// A rubbish or wastewater building's centre (src/waste.ts): it costs its upkeep and, working, gives work; a waste power
// plant feeds the grid like any power plant
Simulation.prototype._wasteFound = function(map, x, y, simData) {
  var power = this._waste.found(map, x, y, simData.census);
  if (power > 0) {
    simData.census.plantPower += power;
    this._powerManager.addSource(x, y);
  }
};


// A month of the rubbish and wastewater (src/waste.ts): this month's people and visitors make rubbish, the buildings
// take what they can and recycling's sales go to the year's taxes; at most once a year each, the news when rubbish lies
// in the streets or a big town's sewage goes untreated, and when a landfill fills up
Simulation.prototype._wasteMonth = function() {
  // ... with what the month's festivals leave, krathong in the rivers and canals among it (src/festivals.ts)
  var people = peopleOf(this._census);
  var month = this._waste.month(people, this._tourism.visitors || 0, this._mining.ground,
                                festivalWaste(this._map, calendarOf(this), people));
  this.budget.wasteFund += month.sales;
  this._emitEvent(Messages.WASTE_UPDATED, month);
  month.filled.forEach(function(site) {
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.LANDFILL_FULL, data: {x: site.x, y: site.y}});
  }, this);
  // ... and warns while there is time to build another (src/waste.ts LANDFILL_WARN)
  month.nearlyFull.forEach(function(site) {
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.LANDFILL_NEARLY_FULL, data: {x: site.x, y: site.y}});
  }, this);

  this._monthsSinceRubbishWarning++;
  this._monthsSinceSewageWarning++;
  if (month.people < WASTE_FROM)
    return;
  if (month.overflow >= 0.25 && this._monthsSinceRubbishWarning >= 12) {
    this._monthsSinceRubbishWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.RUBBISH_OVERFLOW});
  }
  if (month.sewage >= 0.3 && this._monthsSinceSewageWarning >= 12) {
    this._monthsSinceSewageWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.UNTREATED_SEWAGE});
  }
};


// A bus or songthaew stop (src/transit.ts): it costs its upkeep, and works beside a road
Simulation.prototype._busStopFound = function(map, x, y, simData) {
  var road = false;
  [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function(d) {
    if (map.testBounds(x + d[0], y + d[1]) && isRoadTile(map.getTileValue(x + d[0], y + d[1])))
      road = true;
  });
  this._transit.stopFound(x, y, simData.census, road);
};


// A station's centre (src/transit.ts): it costs its upkeep, and works with power
Simulation.prototype._stationFound = function(map, x, y, simData) {
  this._transit.stationFound(map, x, y, simData.census);
};


// A month of the ruler's policies (src/policies.ts): what they do to the demand for each kind of zone, the ground's rain,
// the fields and the harbours, set for the month ahead
Simulation.prototype._policiesMonth = function() {
  var map = this._map;
  var green = hasPolicy(map, 'green_zoning') ? GREEN_DEMAND : 1;
  this._valves.policyPull = hasPolicy(map, 'water_saving') ? -WATER_SAVING_PULL : 0;
  this._valves.policyDemand = {
    residential: green,
    commercial: green * (hasPolicy(map, 'higher_tolls') ? TOLL_SHOPS : 1),
    industrial: green * (hasPolicy(map, 'pollution_tax') ? POLLUTION_TAX_DEMAND : 1)
  };
  this._waterManager.recharge = hasPolicy(map, 'green_zoning') ? GREEN_RECHARGE : 1;
  this._farming.noBurning = hasPolicy(map, 'no_field_burning');
  this._farming.closedSeason = hasPolicy(map, 'fishing_closure') && CLOSED_MONTHS.indexOf(this.getDate().month) !== -1;
};


// Smoke the city's own fields put in the air while their stubble burns, a farm's and at most (src/weather.ts)
var FIELD_SMOKE_PER_FARM = 0.03;
var FIELD_SMOKE_MOST = 0.3;
// The farm zone's fields that make a farm's smoke, and the people a level of homes counts (docs/ZONE_PAINT.md)
var FIELDS_A_FARM = 9;
var PEOPLE_A_HOME_LEVEL = 20;
// Dry months before rain makes the news of the year's first rains
var FIRST_RAINS_AFTER = 3;


// A month of the ruler's house: a new city that has built it is no longer held back; the news hears when it falls,
// and it is forgotten with its wings; its warning tower tells of a season of disasters a month ahead
var SEASON_WARNINGS = {fire: Messages.FIRE_SEASON_AHEAD, flood: Messages.FLOOD_SEASON_AHEAD,
                       tornado: Messages.STORM_SEASON_AHEAD};

Simulation.prototype._houseMonth = function() {
  var map = this._map;
  var standing = houseStanding(map);
  if (standing && map.needsRulerHouse)
    map.needsRulerHouse = false;
  if (!standing && map.rulerHouse) {
    if (this._houseStood)
      this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.RULER_HOUSE_LOST,
                                                   data: {x: map.rulerHouse.x, y: map.rulerHouse.y}});
    map.rulerHouse = null;
    // ... and with it the ruler's policies (src/policies.ts)
    map.policies = [];
  }
  this._houseStood = standing;

  if (!standing || !this.disasterManager.disastersEnabled || !hasWing(map, 'warning_tower'))
    return;
  var month = this.getDate().month;
  var now = seasonalRisks(this.rules, month).map(function(risk) { return risk.disaster; });
  seasonalRisks(this.rules, (month + 1) % 12).forEach(function(risk) {
    if (now.indexOf(risk.disaster) === -1 && SEASON_WARNINGS[risk.disaster])
      this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: SEASON_WARNINGS[risk.disaster]});
  }, this);
};


// PhaiCity's fees (src/budget.js): how much further the water goes for each baht of the water fee (฿10: 30%), and for
// each percent of the visitors' fee, how many fewer come and how much more of what they spend is the city's
var WATER_FEE_SAVING = 0.03;
var TOURIST_FEE_AWAY = 0.01;
var TOURIST_FEE_TAKE = 0.02;

// A month of the schools and hospitals (src/services.ts): the levels their places give the people, which the demand and
// the scans use, and, at most once a year each, the news when a town lacks schools or hospitals
Simulation.prototype._servicesMonth = function() {
  var levels = serviceLevels(this._services.places, peopleOf(this._census));
  this._serviceLevels = levels;
  this._valves.familyPull = familyPull(levels);
  this._valves.skilled = skilled(levels);
  this._emitEvent(Messages.SERVICES_UPDATED, levels);

  this._monthsSinceSchoolWarning++;
  this._monthsSinceHospitalWarning++;
  if (levels.people < WARN_FROM)
    return;
  if (levels.basic < 50 && this._monthsSinceSchoolWarning >= 12) {
    this._monthsSinceSchoolWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.FEW_SCHOOLS});
  }
  if (levels.health < 50 && this._monthsSinceHospitalWarning >= 12) {
    this._monthsSinceHospitalWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.FEW_HOSPITALS});
  }
};


// A month's visitors (src/tourism.ts): more with the ruler's house's culture court, fewer with a visitors' fee, which
// takes a share of what they spend, and fewer where the town's sewage dirties the water (src/waste.ts)
Simulation.prototype._visitors = function(month) {
  // ... the festivals as the ruler holds them (src/festivals.ts), the country's own held modestly before the core has
  // worked out a month of them (a simulation run without the core)
  var visit = tourismMonth(this._tourismLevel(), this._census, month, this._inProvince(),
                           festivalVisits(this._map, calendarOf(this)));
  var fee = this.budget.touristFee || 0;
  var court = hasWing(this._map, 'culture_court');
  var sewage = this._waste.sewage;
  // ... and fewer at a Songkran without water fights (src/policies.ts)
  var dry = (visit.festivals || []).indexOf('songkran') !== -1 && hasPolicy(this._map, 'songkran_saving') ?
            SONGKRAN_VISITORS : 1;
  // ... and more by train and high-speed rail (src/transit.ts)
  var rail = this._transit.visitorFactor();
  // ... and fewer in a storm or the rain (src/weather.ts)
  var weather = weatherVisitors(this._map.weather || null);
  if (visit.level === 0 || (!court && fee === 0 && sewage === 0 && dry === 1 && rail === 1 && weather === 1))
    return visit;
  var come = (court ? CULTURE_VISITORS : 1) * (1 - fee * TOURIST_FEE_AWAY) * (1 - sewage * SEWAGE_AWAY) * dry * rail *
             weather;
  return Object.assign({}, visit, {visitors: Math.round(visit.visitors * come),
                                   income: visit.income * come * (1 + fee * TOURIST_FEE_TAKE),
                                   shopsWanted: visit.shopsWanted * come});
};


Simulation.prototype._setTourism = function(month) {
  this._tourism = month;
  // A water-wise Songkran uses none of the supply (src/policies.ts)
  this._waterManager.festivalUse = (month.festivals || []).indexOf('songkran') !== -1 &&
                                   hasPolicy(this._map, 'songkran_saving') ? 0 :
                                   festivalWaterUse(month);
  this._valves.touristShops = month.shopsWanted;
  this._valves.livingCost = livingCostFactor(month);
  this._emitEvent(Messages.TOURISM_UPDATED, month);
};


// A month of visitors (src/tourism.ts): what they spend goes to the year's taxes; the news hears when a festival or
// the high season begins and, at most once a year, when pollution or crime keeps them away
Simulation.prototype._tourismMonth = function() {
  var month = this.getDate().month;
  var visit = this._visitors(month);
  this._setTourism(visit);
  this.budget.tourismFund += visit.income;
  // Songkran's news, unless the festivals' own news tells how the ruler held it (src/festivals.ts)
  if (visit.festival === 'songkran' && !festivalsRun(this._map))
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.SONGKRAN});
  else if (visit.festival === 'new_year')
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEW_YEAR_HOLIDAYS});
  if (visit.level === 0)
    return;

  this._monthsSinceTouristWarning++;
  if (month === 10 && visit.level >= 2 && visit.visitors > 0)
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.TOURIST_SEASON});

  var worst = Math.max(visit.pollutionPenalty, visit.crimePenalty);
  if (worst >= 0.25 && this._monthsSinceTouristWarning >= 12) {
    this._monthsSinceTouristWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: visit.pollutionPenalty >= visit.crimePenalty ?
                    Messages.TOURISTS_AVOID_POLLUTION : Messages.TOURISTS_AVOID_CRIME});
  }
};


// A month of the farms and fishing harbours (src/farming.ts): their sales to the year's taxes, the factories and markets
// they ask for, and the news when stubble fires spread haze, when the fish run low, or when dirty water spoils a catch;
// the town's untreated sewage dirties the harbours' water too (src/waste.ts)
Simulation.prototype._farmingMonth = function() {
  var water = this._waterManager;
  var pollution = this.blockMaps.pollutionDensityMap;
  var sewage = this._waste.sewage * SEWAGE_DIRT;
  var month = this._farming.month(this.getDate().month, (this.rules.drought && this.rules.drought.months) || [],
    water.stores && water.natural ? {stores: water.stores, natural: water.natural} : null, this._mining.ground,
    function(x, y) { return pollution.worldGet(x, y) + sewage; });
  this.budget.farmFund += month.income;
  // The farm zone's fields (src/farmZone.ts): their crop, the farm visitors' spending, and the factories they ask for;
  // the food the town's people eat, its residents a level at a time as the census counts them
  var fields = this._farming.fields;
  var dryMonths = (this.rules.drought && this.rules.drought.months) || [];
  fields.noBurning = this._farming.noBurning;
  fields.ground = water.stores && water.natural ? {stores: water.stores, natural: water.natural} : null;
  var grown = fields.month(this._map, this.getDate().month, dryMonths.indexOf(this.getDate().month + 1) !== -1,
                           this._census.resPop * PEOPLE_A_HOME_LEVEL, this._farming.farms, this._mining.ground);
  this.budget.farmFund += grown.income;
  this.budget.tourismFund += grown.agroIncome;
  this._valves.farmFactories = this._farming.farms.length * FACTORIES_PER_FARM + grown.levels * fields.spec.factoriesPerLevel;
  this._valves.fishMarkets = this._farming.harbours.length * SHOPS_PER_HARBOUR;

  this._monthsSinceHazeWarning++;
  this._monthsSinceDirtyWarning++;
  var farm = this._farming.farms[0] || (grown.burning > 0 ? fields.firstBurning() : null);
  if ((month.burning || grown.burning > 0) && farm && this._monthsSinceHazeWarning >= 12) {
    this._monthsSinceHazeWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.HAZE, data: {x: farm.x, y: farm.y}});
  }
  if (month.fewFish)
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.FEW_FISH});
  if (month.dirty && this._monthsSinceDirtyWarning >= 12) {
    this._monthsSinceDirtyWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.DIRTY_HARBOUR, data: {x: month.dirty.x, y: month.dirty.y}});
  }
};


// A month of the mines (src/mining.ts): royalties to the year's taxes; the news hears when a kind's ore runs out, when
// an oil well spills, and, at most once a year, when the mines are poisoning the ground
Simulation.prototype._miningMonth = function() {
  var month = this._mining.month(function(n) { return Random.getRandom(n - 1); });
  this.budget.miningFund += month.income;
  month.exhausted.forEach(function(mine) {
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.MINE_EXHAUSTED, data: {x: mine.x, y: mine.y}});
  }, this);
  month.spills.forEach(function(mine) {
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.OIL_SPILL, data: {x: mine.x, y: mine.y}});
  }, this);
  this._monthsSinceToxicWarning++;
  var poisoner = this._mining.mines.find(function(mine) { return mine.kind !== 'limestone' && mine.kind !== 'petroleum'; });
  if (poisoner && this._monthsSinceToxicWarning >= 12) {
    this._monthsSinceToxicWarning = 0;
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.TOXIC_GROUND, data: {x: poisoner.x, y: poisoner.y}});
  }
};


Simulation.prototype._wrapMessage = function(message, data) {
  this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: message, data: data});
};


Simulation.prototype._sendMessages = function() {
  this._checkGrowth();

  var totalZonePop = this._census.resZonePop + this._census.comZonePop +
                     this._census.indZonePop;
  var powerPop = this._census.nuclearPowerPop + this._census.coalPowerPop;

  switch (this._cityTime & 63) {
    case 1:
      if (Math.floor(totalZonePop / 4) >= this._census.resZonePop)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_MORE_RESIDENTIAL});
      break;

    case 5:
      if (Math.floor(totalZonePop / 8) >= this._census.comZonePop)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_MORE_COMMERCIAL});
      break;

    case 10:
      if (Math.floor(totalZonePop / 8) >= this._census.indZonePop)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_MORE_INDUSTRIAL});
      break;

    case 14:
      if (totalZonePop > 10 && totalZonePop * 2 > this._census.roadTotal)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_MORE_ROADS});
      break;

    case 18:
      if (totalZonePop > 50 && totalZonePop > this._census.railTotal)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_MORE_RAILS});
      break;

    case 22:
      if (totalZonePop > 10 && powerPop === 0)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_ELECTRICITY});
      break;

    case 24:
      if (totalZonePop > 10 && this._census.waterWorksPop === 0)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_WATER});
      break;

    case 26:
      if (this._census.resPop > 500 && this._census.stadiumPop === 0) {
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_STADIUM});
        this._valves.resCap = true;
      } else {
        this._valves.resCap = false;
      }
      break;

    case 28:
      if (this._census.indPop > 70 && this._census.seaportPop === 0) {
          this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_SEAPORT});
        this._valves.indCap = true;
      } else {
        this._valves.indCap = false;
      }
      break;

    case 30:
      if (this._census.comPop > 100 && this._census.airportPop === 0) {
          this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_AIRPORT});
        this._valves.comCap = true;
      } else {
        this._valves.comCap = false;
      }
      break;

    case 32:
      var zoneCount = this._census.unpoweredZoneCount + this._census.poweredZoneCount;
      if (zoneCount > 0) {
        if (this._census.poweredZoneCount / zoneCount < 0.7 && powerPop > 0) {
          var d = new Date();
          if (this._lastPowerMessage === null || d - this._lastPowerMessage > 1000 * 60 * 2) {
            this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.BLACKOUTS_REPORTED});
            this._lastPowerMessage = d;
          }
        }
      }
      break;

    case 35:
      if (this._census.pollutionAverage > 60)
        this._emitEvent(Messages.FRONT_END_MESSAGE,
                       {subject: Messages.HIGH_POLLUTION, data: {x: this._map.pollutionMaxX, y: this._map.pollutionMaxY}});
      break;

    case 42:
      if (this._census.crimeAverage > 100)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.HIGH_CRIME});
      break;

    case 45:
      if (this._census.totalPop > 60 && this._census.fireStationPop === 0)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_FIRE_STATION});
      break;

    case 48:
      if (this._census.totalPop > 60 && this._census.policeStationPop === 0)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.NEED_POLICE_STATION});
      break;

    case 51:
      if ((this.budget.averageTax ? this.budget.averageTax() : this.budget.cityTax) > 12)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.TAX_TOO_HIGH});
      break;

    case 54:
      if (this.budget.roadEffect < Math.floor(5 * this.budget.MAX_ROAD_EFFECT / 8) && this._census.roadTotal > 30)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.ROAD_NEEDS_FUNDING});
      break;

    case 57:
      if (this.budget.fireEffect < Math.floor(7 * this.budget.MAX_FIRE_STATION_EFFECT / 10) && this._census.totalPop > 20)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.FIRE_STATION_NEEDS_FUNDING});
      break;

    case 60:
      if (this.budget.policeEffect < Math.floor(7 * this.budget.MAX_POLICE_STATION_EFFECT / 10) && this._census.totalPop > 20)
        this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.POLICE_NEEDS_FUNDING});
      break;

  case 63:
    if (this._census.trafficAverage > 60)
      this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: Messages.TRAFFIC_JAMS});
    break;
  }
};


Simulation.prototype._checkGrowth = function() {
  if ((this._cityTime & 3) !== 0)
    return;

  var message = '';
  var cityPop = this.evaluation.getPopulation(this._census);

  if (cityPop !== this._cityPopLast) {
    var lastClass = this.evaluation.getCityClass(this._cityPopLast);
    var newClass = this.evaluation.getCityClass(cityPop);

    if (lastClass !== newClass) {
      switch (newClass) {
        case Evaluation.CC_VILLAGE:
          // Don't mention it.
          break;

        case Evaluation.CC_TOWN:
          message = Messages.REACHED_TOWN;
          break;

        case Evaluation.CC_CITY:
          message = Messages.REACHED_CITY;
          break;

        case Evaluation.CC_CAPITAL:
          message = Messages.REACHED_CAPITAL;
            break;

        case Evaluation.CC_METROPOLIS:
          message = Messages.REACHED_METROPOLIS;
          break;

        case Evaluation.CC_MEGALOPOLIS:
          message = Messages.REACHED_MEGALOPOLIS;
          break;

        default:
          break;
      }
    }
  }

  if (message !== '' && message !== this._messageLast) {
    this._emitEvent(Messages.FRONT_END_MESSAGE, {subject: message});
    this._messageLast = message;
  }

  this._cityPopLast = cityPop;
};


Simulation.prototype._onValveChange  = function() {
  this._resLast = this._valves.resValve;
  this._comLast = this._valves.comValve;
  this._indLast = this._valves.indValve;

  this._emitEvent(Messages.VALVES_UPDATED, {residential: this._valves.resValve,
                                            commercial: this._valves.comValve,
                                            industrial: this._valves.indValve});
};


Simulation.prototype.getDate = function() {
  var year = Math.floor(this._cityTime / 48) + this._startingYear;
  var month = Math.floor(this._cityTime % 48) >> 2;
  return {month: month, year: year};
};


Simulation.prototype._setYear = function(year) {
  if (year < this._startingYear)
    year = this._startingYear;

  year = (year - this._startingYear) - (this._cityTime / 48);
  this._cityTime += year * 48;
  this._updateTime();
};


Simulation.prototype._updateTime = function() {
  var megalinium = 1000000;
  var cityYear = Math.floor(this._cityTime / 48) + this._startingYear;
  var cityMonth = Math.floor(this._cityTime % 48) >> 2;

  if (cityYear >= megalinium) {
    this.setYear(startingYear);
    return;
  }

  if (this._cityYearLast !== cityYear || this._cityMonthLast !== cityMonth) {
    this._cityYearLast = cityYear;
    this._cityMonthLast = cityMonth;
    this._emitEvent(Messages.DATE_UPDATED, {month: cityMonth, year: cityYear});
  }
};


Object.defineProperties(Simulation,
  {LEVEL_EASY: MiscUtils.makeConstantDescriptor(0),
  LEVEL_MED:  MiscUtils.makeConstantDescriptor(1),
  LEVEL_HARD: MiscUtils.makeConstantDescriptor(2),
  SPEED_PAUSED: MiscUtils.makeConstantDescriptor(0),
  SPEED_SLOW:  MiscUtils.makeConstantDescriptor(1),
  SPEED_MED: MiscUtils.makeConstantDescriptor(2),
  SPEED_FAST: MiscUtils.makeConstantDescriptor(3),
});


export { Simulation };
