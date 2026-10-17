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

import $ from "jquery";

import { attachGameAudio } from './audio/gameAudio.ts';
import { installAutosave, showFullNote, showSavedNote } from './autosave.ts';
import { audio, music } from './audio/index.ts';
import { BaseTool } from './baseTool.js';
import { BudgetWindow } from './budgetWindow.js';
import { besideRoad, CityCommands, NEEDS_ROAD_BESIDE, NEEDS_WATER, NO_RESOURCE, OUTSIDE_PROVINCE, placeProblem } from './cityCommands.ts';
import { CityCore } from './core/cityCore.ts';
import { showDemandAndPeople, showServices, showTourism, showWaste } from './cityStatus.ts';
import { areaCentres, areaFootprint, SPRITE_UNITS_PER_TILE } from './cityView.ts';
import { createCityView2D } from './cityView2d.ts';
import { showCornerNote, showCornerNoteOnce } from './cornerNote.ts';
import { grownFrame, reframeSave } from './cityFrame.ts';
import { DISTRICT_BLOCK, framePreset, freshFrame } from './geo/districtFrame.ts';
import { Config } from './config.js';
import { CongratsWindow } from './congratsWindow.js';
import { DebugWindow } from './debugWindow.js';
import { DisasterWindow } from './disasterWindow.js';
import { EvaluationWindow } from './evaluationWindow.js';
import { GameMap } from './gameMap.js';
import { decodePresetLayer, encodePresetLayer } from './geo/presetMap.ts';
import { GraphWindow } from './graphWindow.js';
import { applyTranslations, formatMoney, getLanguage, onLanguageChange, setTerm, t } from './i18n/index.ts';
import { InfoBar } from './infoBar.js';
import { InputStatus } from './inputStatus.js';
import { MainMenuWindow } from './mainMenuWindow.js';
import { listCities, saveCity, StorageFullError } from './cityStorage.ts';
import { MapWindow } from './mapWindow.js';
import { toolPrices } from './provinceRules.ts';
import { canBuildKind, kindOfTool, POWER_KINDS, PLANT_TOOLS } from './powerPlants.ts';
import { canDig, MINE_KINDS, MINE_TOOLS, mineKindOfTool } from './mining.ts';
import { clearToolChoices, pageChoice, setToolChoices } from './toolLevels.ts';
import { drawModeOf, isAreaMode, isPaintTool, modeGroupOf, POINTS_NEEDED, showsZoneGrid, snapOn } from './drawModes.ts';
import { cellsAlong, cellsOf } from './zoneCells.ts';
import { nearestOnLines, networkOf, realUnits, roadLines, roadReach, smoothLine } from './roadGeometry.ts';
import { placesBuilding } from './gameTools.js';
import { BUILDING_SCALE } from './render3d/city/tileModels.ts';
import { curvePath, gridPath, joinAngle, linePath, rectanglePath, snapAngle, snapPoint } from './drawPaths.ts';
import { ERASE_TOOL, fillRegion, PAINT_PRICE_SHARE, PAINT_TOOLS, PLOT_KINDS } from './plots.ts';
import { farmLevel, fisheryLevel } from './farming.ts';
import { relabelTools, showToolPrices } from './toolShortcuts.ts';
import { CIVIC, LASTPOWER, LASTRAIL, MINE, POWERBASE, POWERPLANT, RAILBASE, STATION, WASTE, WATER_HIGH, WATER_LOW } from './tileValues.ts';
import { NEEDS_RAIL, ONE_HSR, TRANSIT_KINDS, TRANSIT_NEEDS_RANK, TRANSIT_SPECS } from './transit.ts';
import { WASTE_KINDS } from './waste.ts';
import { HouseWindow } from './houseWindow.ts';
import { PolicyWindow } from './policyWindow.ts';
import { fadeCurtain } from './curtain.ts';
import { readPolicies } from './policies.ts';
import { blockSizeOf, blockColumns, blockOutlineTile, blockPrice, blockRows, blocksByRank, LAND_ALL_OPEN, LAND_LOCKED,
         LAND_NEEDS_RANK, LAND_NO_MONEY, LAND_NOT_BESIDE, LAND_OUTSIDE, LAND_OWNED, LAND_REASONS, isCityMap, ownsLand,
         startingBlocks } from './landBlocks.ts';
import { EDUCATION_TOOLS, HEALTH_TOOLS, NEEDS_HOUSE_LEVEL, SERVICE_SPECS } from './services.ts';
import { BUILDING_UPGRADE_TOOL, LEVEL_GROUPS, levelOfTool, levelSpec } from './buildingLevels.ts';
import { upgradeAt } from './buildingUpgradeTool.ts';
import {
  hasWing, HOUSE_AT_TOP, HOUSE_FIRST, HOUSE_KIND, HOUSE_REASONS, HOUSE_STANDS, HOUSE_TOOL, HOUSE_UPGRADE_TOOL, houseFirst,
  houseSpec, houseStanding, MAX_HOUSE_LEVEL, NEEDS_RANK, NEEDS_ROAD, PLANNING_DISCOUNT, readHouse
} from './rulerHouse.ts';
import { isRoadTile, newRoadLevels, ROAD_TOOLS, roadLevelAt, UPGRADE_TOOL } from './roadLevels.ts';
import { streetLabel } from './streetNames.ts';
import { installMousePan, installViewControls, panOf, setViewHome } from './viewControls.ts';
import { installCameraBar } from './cameraModes.ts';
import { inspectAt } from './inspect.ts';
import { InspectCard } from './inspectCard.ts';
import * as Messages from './messages.ts';
import { MonsterTV } from './monsterTV.js';
import { installNewsLog } from './newsLog.ts';
import { NagWindow } from './nagWindow.js';
import { Notification } from './notification.js';
import { QueryWindow } from './queryWindow.js';
import { Random } from './random.ts';
import { RCI } from './rci.js';
import { installRulerGoals } from './rulerGoals.ts';
import { keepHigherRank, RANKS, rankForCityClass } from './rulerRank.ts';
import { SaveWindow } from './saveWindow.js';
import { ScreenshotLinkWindow } from './screenshotLinkWindow.js';
import { ScreenshotWindow } from './screenshotWindow.js';
import { SettingsWindow } from './settingsWindow.js';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';
import { Text } from './text.js';
import { TouchWarnWindow } from './touchWarnWindow.js';

var disasterTimeout = 20 * 1000;

// A tool outside the province: its outline turns this colour, and a click says why nothing happens
var OUTSIDE_COLOUR = '#e0453a';
var OUTSIDE_NOTE_MS = 2500;
// A road, railway or power line being drawn (src/drawModes.ts)
var DRAW_COLOUR = '#3d9be9';
// The kinds of power plant's colours, for their squares until their icons are drawn (src/toolLevels.ts)
var PLANT_COLOURS = {lignite: 'gray', gas: '#6f9fc4', hydro: '#2a7fd4', solar: '#e8b100', wind: '#7fc8b5'};
var MINE_COLOUR = '#b07848';
// The rubbish and wastewater buildings' colours above the tools (src/waste.ts)
var WASTE_COLOURS = {landfill: '#8a6d3b', incinerator: '#7a5c58', recycling_plant: '#4f9a5a',
                     waste_power_plant: '#b07a2a', wastewater_plant: '#3f7fa6'};
// ... and public transport's (src/transit.ts)
// The notes for a block of land that may not be bought (src/landBlocks.ts)
var LAND_KEYS = {};
LAND_KEYS[LAND_OWNED] = 'owned';
LAND_KEYS[LAND_NOT_BESIDE] = 'not_beside';
LAND_KEYS[LAND_OUTSIDE] = 'outside';
LAND_KEYS[LAND_NEEDS_RANK] = 'needs_rank';
LAND_KEYS[LAND_NO_MONEY] = 'no_money';
LAND_KEYS[LAND_ALL_OPEN] = 'all_open';
var TRANSIT_COLOURS = {bus_stop: '#e3a21a', train_station: '#8c5a3c', metro_station: '#2f6db5', hsr_station: '#c0392b'};

// Each size the city can reach, with its city class (src/evaluation.js), which sets the ruler's rank
var MILESTONES = {};
MILESTONES[Messages.REACHED_TOWN] = {name: 'town', cityClass: 'TOWN'};
MILESTONES[Messages.REACHED_CITY] = {name: 'city', cityClass: 'CITY'};
MILESTONES[Messages.REACHED_CAPITAL] = {name: 'capital', cityClass: 'CAPITAL'};
MILESTONES[Messages.REACHED_METROPOLIS] = {name: 'metropolis', cityClass: 'METROPOLIS'};
MILESTONES[Messages.REACHED_MEGALOPOLIS] = {name: 'megalopolis', cityClass: 'MEGALOPOLIS'};


// view3d: null for the original 2D view, or {create, region} for the three.js view (src/splashScreen.js prepareView)
// rules: the province's rules (src/provinceRules.ts), or null for the game's own
// resources (PhaiCity): the province's resource levels (src/splashScreen.js loadResources), or null
function Game(gameMap, tileSet, snowTileSet, spriteSheet, difficulty, name, view3d, rules, resources) {
  difficulty = difficulty || 0;
  var savedGame;

  if (!gameMap.isSavedGame) {
    this.gameMap = gameMap;
    savedGame = null;
  } else {
    // Province maps are larger than the classic 120x100, so size the map from the save itself
    this.gameMap = new GameMap(gameMap.width || 120, gameMap.height || 100);
    savedGame = gameMap;
    // What a saved city's map file gives it that saves do not keep (src/splashScreen.js savedCityHeights,
    // loadProvinceBackdrop): where it lies on the earth and in its district, the province round it, its land cover
    // and its streets' names
    ['mapCenter', 'districtPlace', 'provinceBackdrop', 'landCover', 'roadNames', 'streetNameList'].forEach(function(key) {
      if (gameMap[key] !== undefined)
        this.gameMap[key] = gameMap[key];
    }, this);
  }

  // Which province and online world this city belongs to (both null for offline random maps)
  var source = savedGame || gameMap;
  this.provinceId = source.provinceId || null;
  // ... and which district, when the city stands in one district's town (data/maps/district/)
  this.districtId = source.districtId || null;
  // Its first building is the district's ที่ว่าการอำเภอ, or a province city's ศาลากลางจังหวัด (owner 13 Oct 2026); every
  // string names it as {office} (src/i18n/index.ts setTerm)
  var provinceCity = this.provinceId !== null && this.districtId === null;
  setTerm('office', provinceCity ? 'office.province' : 'office.district');
  setTerm('office_short', provinceCity ? 'office.province.short' : 'office.district.short');
  applyTranslations();
  relabelTools();
  // Which saved city this is (src/cityStorage.ts); a new city gets its id when first saved
  this.cityId = savedGame ? savedGame.cityId || null : null;
  // When the city was last saved, for the main menu (ms since 1970, null for a city never saved)
  var savedMeta = this.cityId ? listCities().find(function(city) { return city.id === this.cityId; }, this) : null;
  this.lastSavedAt = savedMeta ? savedMeta.savedAt : null;
  this.worldId = source.worldId || null;

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.defaultSpeed = Simulation.SPEED_MED;
  // The city itself, built the same way as without a screen (src/core/, docs/CORE_DESIGN.md): the records beside its
  // tiles (a province map's own land and town, the kinds of each building, road levels …), the simulation, its
  // objects and the commands that change it
  var coreGame = this;
  this.core = new CityCore({
    map: this.gameMap, saved: savedGame, level: difficulty, speed: this.defaultSpeed,
    rules: rules || null, resources: resources || null,
    hooks: {
      // The ruler's house's next level needs the ruler's rank (src/rulerHouse.ts)
      rank: function() { return Math.max(0, RANKS.indexOf(coreGame.rulerRank)); },
      // The camera's start and ⌂ follow the house
      houseBuilt: function(x, y) { setViewHome({x: x, y: y}); }
    }
  });
  this.simulation = this.core.simulation;

  // A new province city starts with that province's treasury (src/geo/provinceProfile.ts)
  if (!savedGame && gameMap.startingFunds)
    this.simulation.budget.setFunds(gameMap.startingFunds);

  this.name = name || 'MyTown';
  this.everClicked = false;

  if (savedGame)
    this.load(savedGame);

  // Every building as an object of its own (src/objects/), kept up by the core each month
  this.cityObjects = this.core.objects;

  // The ruler's rank follows the city's size and is never lost (src/rulerRank.ts); older saves have none yet
  this.rulerRank = keepHigherRank(savedGame ? savedGame.rulerRank : null,
                                  rankForCityClass(this.simulation.evaluation.cityClass));

  this.rci = new RCI('RCIContainer', this.simulation);
  // The same demand, as percentages with the people in homes, shops and factories, in the status (src/cityStatus.ts)
  showDemandAndPeople(this.simulation);
  showTourism(this.simulation);
  showServices(this.simulation);
  showWaste(this.simulation);

  // What draws the city (src/cityView.ts); the game talks to it in map tiles only.
  // Note: must create the view before inputStatus, which listens to the view's canvas
  this.cityView = view3d ? createView3D(this, view3d) : null;
  if (this.cityView && this.cityView.relabelStreets)
    onLanguageChange(this.cityView.relabelStreets.bind(this.cityView));
  if (this.cityView === null)
    this.cityView = createCityView2D('canvasContainer', this.gameMap, this.tileSet, spriteSheet);
  this.inputStatus = new InputStatus(this.gameMap, tileSet.tileWidth, this.simulation.rules, this.core.tools);
  // The tool buttons show this province's prices
  this._planningFactor = 1;
  this.refreshPrices();
  // Buying land only where the map is cut into blocks (src/landBlocks.ts)
  var landButton = document.getElementById('landButton');
  if (landButton)
    landButton.hidden = !this.gameMap.landBlocks;

  // Every change the player makes goes through this one entry point as a plain command (src/cityCommands.ts), which
  // the core builds the same way for every city (src/core/cityLayers.ts commandTarget)
  var simulation = this.simulation;
  var cityMap = this.gameMap;
  var game = this;
  this.commands = this.core.commands;

  // The power button's places above the tools are its kinds of plant, and the nuclear plant; those the province
  // cannot build wait
  setToolChoices('coal', POWER_KINDS.map(function(kind) {
    return {tool: PLANT_TOOLS[kind], available: canBuildKind(kind, simulation.resources), colour: PLANT_COLOURS[kind]};
  }).concat([pageChoice('nuclear')]));
  // Buttons that group tools (docs/TOOLS_PLAN.md): safety, water, farms and harbours, long-distance transport
  setToolChoices('waterworks', [pageChoice('waterworks'), pageChoice('watertower')]);
  setToolChoices('farm', [pageChoice('farm', farmLevel(simulation.resources) >= 1),
    pageChoice('fishing', fisheryLevel(simulation.resources) >= 1)]);
  setToolChoices('port', [pageChoice('port'), pageChoice('airport')]);
  // The rubbish button's places are its five buildings, the landfill first (src/waste.ts)
  setToolChoices('landfill', WASTE_KINDS.map(function(kind) {
    return {tool: kind, available: true, colour: WASTE_COLOURS[kind]};
  }));
  // The road button's places are its levels, and the upgrade tool that raises a road one level at a time
  setToolChoices('road', ROAD_TOOLS.map(function(tool) { return {tool: tool, available: true, colour: '#3a3a3a'}; })
    .concat([{tool: UPGRADE_TOOL, available: true, colour: '#d9a400', note: 'choice.upgrade_note'}]));
  // On a map with painted zones the home, shop and factory buttons are brushes, with the eraser beside them
  PLOT_KINDS.forEach(function(kind) {
    if (!cityMap.paintedZones) {
      clearToolChoices(kind);
      return;
    }
    var button = document.querySelector('.toolButton[data-tool="' + kind + '"]');
    setToolChoices(kind, [
      {tool: PAINT_TOOLS[kind], available: true, colour: button ? button.getAttribute('data-colour') : undefined, size: 1},
      {tool: ERASE_TOOL, available: true, colour: '#8c8c8c', size: 1, note: 'choice.erase_note'}]);
  });
  // The mine button's places are the ores the province has; those it lacks are left out
  setToolChoices('mine', MINE_KINDS.filter(function(kind) { return canDig(kind, simulation.resources); })
    .map(function(kind) { return {tool: MINE_TOOLS[kind], available: true, colour: MINE_COLOUR}; }));
  // The ruler's house button's places, and the tools held back until a new city has its house (src/rulerHouse.ts)
  this.refreshHouse();

  // Sound only listens to the game; it never changes the city
  this.gameAudio = attachGameAudio(this, audio, Text);
  // The music of the city's region (the main theme on practice maps)
  music.playForProvince(this.provinceId);

  this.dialogOpen = false;
  this._openWindow = null;
  this.mouse = null;
  this.lastCoord = null;
  this.simNeededBudget = false;
  this.isPaused = false;
  this.lastBadMessageTime = null;

  var self = this;
  if (!this.everClicked) {
    this.nagger = window.setTimeout(function() {
      self.dialogOpen = true;
      self._openWindow = 'nagWindow';
      self.nagWindow.open();
    }, 30 * 60 * 1000);

    $('.nag').each(function() {
      $(this).click(function(e) {
        if (self.nagger !== null) {
          window.clearTimeout(self.nagger);
        self.nagger = null;
        self.everClicked = true;
      }

      return true;
      });
    });
  }

  // Initialise monsterTV
  // (a small 2D view that follows disasters; it shares the 2D view's tile animations, so it exists only in 2D)
  this.monsterTV = this.cityView.kind === '2d' ?
    new MonsterTV(this.gameMap, tileSet, spriteSheet, this.cityView.canvas.animationManager) : null;

  var opacityLayerID = 'opaque';

  this.genericDialogClosure = genericDialogClosure.bind(this);

  // Hook up listeners to open/close evaluation window
  this.handleEvalRequest = makeWindowOpenHandler('eval', function() {
    return [this.simulation.evaluation];
  }.bind(this));

  this.evalWindow = new EvaluationWindow(opacityLayerID, 'evalWindow');
  this.evalWindow.addEventListener(Messages.EVAL_WINDOW_CLOSED, this.genericDialogClosure);
  this.inputStatus.addEventListener(Messages.EVAL_REQUESTED, this.handleEvalRequest.bind(this));

  // The city graphs (src/graphWindow.js), opened from the Evaluation window; they read the census's history
  this.handleGraphsRequest = makeWindowOpenHandler('graph', function() {
    return [this.simulation._census];
  }.bind(this));

  this.graphWindow = new GraphWindow(opacityLayerID, 'graphWindow');
  this.graphWindow.addEventListener(Messages.GRAPH_WINDOW_CLOSED, this.genericDialogClosure);
  this.evalWindow.addEventListener(Messages.GRAPHS_REQUESTED, this.handleGraphsRequest.bind(this));

  // The city map (src/mapWindow.js) reads the map, the overlays and the part on screen; a click on it moves the view
  this.handleMapRequest = makeWindowOpenHandler('map', function() {
    return [this.gameMap, this.mapOverlays(), this.cityView.visibleTiles()];
  }.bind(this));

  this.mapWindow = new MapWindow(opacityLayerID, 'mapWindow');
  // The layer the city map shows lies over the city's ground while the window is open (src/render3d/city/layerOverlay.ts)
  this.mapWindow.onLayer = function(tiles) {
    if (typeof this.cityView.showLayer === 'function')
      this.cityView.showLayer(tiles);
  }.bind(this);
  this.mapWindow.addEventListener(Messages.MAP_WINDOW_CLOSED, function(target) {
    this.genericDialogClosure();
    if (target !== null)
      this.cityView.centreOn(target.x, target.y);
  }.bind(this));
  this.inputStatus.addEventListener(Messages.MAP_REQUESTED, this.handleMapRequest.bind(this));

  // ... and similarly for the budget window
  this.handleBudgetRequest = makeWindowOpenHandler('budget', function() {
    var budgetData = {
      roadMaintenanceBudget: this.simulation.budget.roadMaintenanceBudget,
      roadRate: Math.floor(this.simulation.budget.roadPercent * 100),
      fireMaintenanceBudget: this.simulation.budget.fireMaintenanceBudget,
      fireRate: Math.floor(this.simulation.budget.firePercent * 100),
      policeMaintenanceBudget: this.simulation.budget.policeMaintenanceBudget,
      policeRate: Math.floor(this.simulation.budget.policePercent * 100),
      taxRate: this.simulation.budget.cityTax,
      totalFunds: this.simulation.budget.totalFunds,
      taxesCollected: this.simulation.budget.taxFund,
      tourismIncome: this.simulation.budget.tourismIncome,
      fuelCost: this.simulation.budget.fuelCost,
      miningIncome: this.simulation.budget.miningIncome,
      farmIncome: this.simulation.budget.farmIncome,
      tollIncome: this.simulation.budget.tollIncome,
      houseCost: this.simulation.budget.houseCost,
      // The shops' and factories' taxes and the two fees (src/budget.js)
      comTax: this.simulation.budget.comTax,
      indTax: this.simulation.budget.indTax,
      waterFee: this.simulation.budget.waterFee,
      touristFee: this.simulation.budget.touristFee,
      waterIncome: this.simulation.budget.waterIncome,
      educationCost: this.simulation.budget.educationCost,
      healthCost: this.simulation.budget.healthCost,
      // ... and the rubbish and wastewater (src/waste.ts)
      wasteCost: this.simulation.budget.wasteCost,
      recyclingIncome: this.simulation.budget.recyclingIncome,
      // ... and the ruler's policies (src/policies.ts)
      policyCost: this.simulation.budget.policyCost,
      pollutionTaxIncome: this.simulation.budget.pollutionTaxIncome,
      // ... and public transport (src/transit.ts)
      transitCost: this.simulation.budget.transitCost
    };

    return [budgetData];
  }.bind(this));

  this.budgetWindow = new BudgetWindow(opacityLayerID, 'budget');
  this.budgetWindow.addEventListener(Messages.BUDGET_WINDOW_CLOSED, this.handleBudgetWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.BUDGET_REQUESTED, this.handleBudgetRequest.bind(this));

  // ... and also the disaster window
  this.disasterWindow = new DisasterWindow(opacityLayerID, 'disasterWindow');
  this.disasterWindow.addEventListener(Messages.DISASTER_WINDOW_CLOSED, this.handleDisasterWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.DISASTER_REQUESTED, this.handleDisasterRequest.bind(this));

  // ... the debug window
  this.debugWindow = new DebugWindow(opacityLayerID, 'debugWindow');
  this.debugWindow.addEventListener(Messages.DEBUG_WINDOW_CLOSED, this.handleDebugWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.DEBUG_WINDOW_REQUESTED, this.handleDebugRequest.bind(this));

  // ... the settings window
  this.handleSettingsRequest = makeWindowOpenHandler('settings', function() {
    return [{autoBudget: this.simulation.budget.autoBudget, autoBulldoze: BaseTool.getAutoBulldoze(),
             speed: this.defaultSpeed, disasters: this.simulation.disasterManager.disastersEnabled}];
  }.bind(this));
  this.settingsWindow = new SettingsWindow(opacityLayerID, 'settingsWindow');
  this.settingsWindow.addEventListener(Messages.SETTINGS_WINDOW_CLOSED, this.handleSettingsWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.SETTINGS_WINDOW_REQUESTED, this.handleSettingsRequest.bind(this));

  // ... the screenshot window
  this.screenshotWindow = new ScreenshotWindow(opacityLayerID, 'screenshotWindow');
  this.screenshotWindow.addEventListener(Messages.SCREENSHOT_WINDOW_CLOSED, this.handleScreenshotWindowClosure.bind(this));
  this.inputStatus.addEventListener(Messages.SCREENSHOT_WINDOW_REQUESTED, this.handleScreenshotRequest.bind(this));

  // ... the screenshot link window
  this.screenshotLinkWindow = new ScreenshotLinkWindow(opacityLayerID, 'screenshotLinkWindow');
  this.screenshotLinkWindow.addEventListener(Messages.SCREENSHOT_LINK_CLOSED, this.genericDialogClosure);

  // ... the save confirmation window
  this.saveWindow = new SaveWindow(opacityLayerID, 'saveWindow');
  this.saveWindow.addEventListener(Messages.SAVE_WINDOW_CLOSED, this.genericDialogClosure);

  // ... the window that leads back to the start screen
  this.handleMainMenuRequest = makeWindowOpenHandler('mainMenu', function() {
    return [this.name, Storage.canStore, this.lastSavedAt];
  }.bind(this));
  this.mainMenuWindow = new MainMenuWindow(opacityLayerID, 'mainMenuWindow');
  this.mainMenuWindow.addEventListener(Messages.MAIN_MENU_WINDOW_CLOSED, this.handleMainMenuClosure.bind(this));
  $('#mainMenuRequest').on('click', this.handleMainMenuRequest.bind(this));

  // ... the nag confirmation window
  this.nagWindow = new NagWindow(opacityLayerID, 'nagWindow');
  this.nagWindow.addEventListener(Messages.NAG_WINDOW_CLOSED, this.genericDialogClosure);

  // ... the touch warn window
  this.touchWindow = new TouchWarnWindow(opacityLayerID, 'touchWarnWindow');
  this.touchWindow.addEventListener(Messages.TOUCH_WINDOW_CLOSED, this.genericDialogClosure);

  // ... and finally the query window
  this.queryWindow = new QueryWindow(opacityLayerID, 'queryWindow');
  this.queryWindow.addEventListener(Messages.QUERY_WINDOW_CLOSED, this.genericDialogClosure);
  this.inputStatus.addEventListener(Messages.QUERY_WINDOW_NEEDED, this.handleQueryRequest.bind(this));

  // Listen for clicks on the save button
  this.inputStatus.addEventListener(Messages.SAVE_REQUESTED, this.handleSave.bind(this));

  // Listen for front end messages
  this.simulation.addEventListener(Messages.FRONT_END_MESSAGE, this.processFrontEndMessage.bind(this));

  // Listen for budget messages
  this.simulation.addEventListener(Messages.BUDGET_NEEDED, this.handleMandatoryBudget.bind(this));

  // Listen for tool clicks
  this.inputStatus.addEventListener(Messages.TOOL_CLICKED, this.handleTool.bind(this));
  this.inputStatus.addEventListener(Messages.TOOL_AREA, this.handleToolArea.bind(this));
  // Lines, curves and fills drawn by clicks, and a right click that drops a line half drawn (src/drawModes.ts)
  this.lineDraft = null;
  this._edits = 0;
  this._preview = null;
  this.inputStatus.addEventListener(Messages.TOOL_POINT, this.handleToolPoint.bind(this));
  this.inputStatus.addEventListener(Messages.TOOL_CANCEL, this.cancelDraft.bind(this));
  // Undo: the ↶ button in the tool panel, and Ctrl+Z (src/toolShortcuts.ts presses the button)
  $('#undoButton').on('click', this.handleUndo.bind(this));
  this.refreshUndo();

  // And pauses
  this.inputStatus.addEventListener(Messages.SPEED_CHANGE, this.handlePause.bind(this));

  // And date changes
  // XXX Not yet activated
  //this.simulation.addEventListener(Messages.DATE_UPDATED, this.onDateChange.bind(this));

  this.infoBar = InfoBar('cclass', 'population', 'score', 'funds', 'date', 'name');
  var initialValues = {
    classification: this.simulation.evaluation.cityClass,
    population: this.simulation.evaluation.cityPop,
    score: this.simulation.evaluation.cityScore,
    funds: this.simulation.budget.totalFunds,
    date: this.simulation.getDate(),
    name: this.name
  };
  this.infoBar(this.simulation, initialValues);
  this.showRulerRank();
  onLanguageChange(this.showRulerRank.bind(this));

  // Recent news, behind the "News" button by the news bar (src/newsLog.ts), saved with the city
  this.newsLog = installNewsLog({
    date: function() { return simulation.getDate(); },
    text: function(subject) { return Text.messageText[subject]; },
    monthName: function(month) { return Text.months[month]; },
    centreOn: function(x, y) { self.cityView.centreOn(x, y); },
    saved: savedGame ? savedGame.news : null
  });
  this._notificationBar = new Notification('#notifications', this.cityView, Text.messageText[Messages.WELCOME],
                                           this.newsLog);

  this.congratsWindow = new CongratsWindow(opacityLayerID, 'congratsWindow');
  this.congratsWindow.addEventListener(Messages.CONGRATS_WINDOW_CLOSED, this.genericDialogClosure);

  // The ruler's house and its wings (src/houseWindow.ts): wings are built and taken off as commands
  this.houseWindow = new HouseWindow(opacityLayerID, 'houseWindow');
  this.houseWindow.source = {
    house: function() { return houseStanding(self.gameMap) ? self.gameMap.rulerHouse : null; },
    funds: function() { return self.simulation.budget.totalFunds; },
    changeWing: function(wing, add) {
      var outcome = self.applyCommand({type: 'wing', wing: wing, add: add});
      self.refreshHouse();
      return outcome.accepted;
    }
  };
  this.houseWindow.addEventListener(Messages.HOUSE_WINDOW_CLOSED, this.genericDialogClosure);
  // ... and the ruler's policies (src/policyWindow.ts), switched as commands
  this.policyWindow = new PolicyWindow(opacityLayerID, 'policyWindow');
  this.policyWindow.source = {
    map: function() { return self.gameMap; },
    change: function(policy, on) {
      return self.applyCommand({type: 'policy', policy: policy, on: on}).accepted;
    }
  };
  this.policyWindow.addEventListener(Messages.POLICY_WINDOW_CLOSED, this.genericDialogClosure);

  // Listen for touches, so we can warn tablet users
  this.touchListener = touchListener.bind(this);
  window.addEventListener('touchstart', this.touchListener, false);

  // Unhide controls
  this.revealControls();

  // First tasks for a new ruler (src/rulerGoals.ts); a city saved before them that is already a town skips them
  var goalsSave = savedGame ? savedGame.goals : null;
  if (savedGame && !goalsSave && this.rulerRank !== 'muen')
    goalsSave = {done: [], dismissed: true};
  this.rulerGoals = installRulerGoals(this.simulation, goalsSave);

  // Autosave (src/autosave.ts): a province city from the start, a practice city once it has been saved by hand
  this.autosave = installAutosave({
    save: this.save.bind(this),
    shouldAutosave: function() { return self.provinceId !== null || self.cityId !== null; }
  }, {onSaved: showSavedNote, onFull: showFullNote});
  // A city whose land already reaches near the edge of its district's frame opens more of the district at once
  // (docs/DISTRICT_FRAME.md)
  this.growFrame();

  // The 3D view's turn and reset buttons, and sliding the city with the mouse when no tool is in hand
  // (src/viewControls.ts), with a note on the mouse the first time
  installViewControls(this.cityView);
  // A whole-province city opens on its town, and ⌂ brings the camera back there
  var town = this.gameMap.town || null;
  setViewHome(town);
  if (town !== null)
    this.cityView.centreOn(town.x, town.y);
  // ... and a click with no tool in hand shows what is there (src/inspect.ts, src/inspectCard.ts)
  var inspectElement = document.getElementById('inspectCard');
  this.inspectCard = inspectElement ? new InspectCard(inspectElement) : null;
  installMousePan(this.cityView, function() { return self.inputStatus.currentTool !== null; }, document,
                  function(x, y) { self.inspectAtPixel(x, y); });
  // The camera's buttons down the right edge (src/cameraModes.ts), for the 3D view
  installCameraBar(this.cityView, function() { self.inputStatus.clearTool(); });
  onLanguageChange(function() { if (self.inspectCard) self.inspectCard.render(); });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && self.inspectCard && self.inspectCard.isOpen)
      self.inspectCard.close();
  });
  if (panOf(this.cityView) !== null)
    showCornerNoteOnce('phaicity.mouseHint', t('view.mouse_hint'), 10000);

  // Run the sim
  this.tick = tick.bind(this);
  this.tick();

  // Paint the map
  var debug = Config.debug || Config.gameDebug;
  if (debug) {
    $('#debug').toggle();
    this.frameCount = 0;
    this.animStart = new Date();
    this.lastElapsed = -1;
  }

  this.commonAnimate = commonAnimate.bind(this);
  this.animate = (debug ? debugAnimate : this.commonAnimate).bind(this);
  this.animate();
}


// What a click on the map shows (src/inspect.ts): the object on the tile, or the road, water or land there
Game.prototype.inspectTile = function(x, y) {
  if (!this.inspectCard)
    return;
  // A building put up since the month's look over the map is found now
  this.core.objects.scan(this.gameMap, this.simulation._cityTime);
  var found = inspectAt({map: this.gameMap, objects: this.core.objects, blockMaps: this.simulation.blockMaps,
                         cityTime: this.simulation._cityTime, startingYear: this.simulation._startingYear,
                         language: getLanguage(), satisfaction: this.satisfactionContext()}, x, y);
  // Clicking empty land/woods/water while an object/road card is already open closes the card cleanly
  var isPlainGround = found && ['object.kind.land', 'object.kind.woods', 'object.kind.water'].indexOf(found.title.key) !== -1 &&
                      (!found.facts || found.facts.every(function(f) { return f.key.indexOf('object.fact.why.') !== 0; }));
  if (found && !(this.inspectCard.isOpen && isPlainGround))
    this.inspectCard.open(found);
  else
    this.inspectCard.close();
};


// With no tool in hand, the outline round what the inspector's card shows (a building's centre is one tile in from
// its top-left corner, as the tools place it; roads do not draw a floating ghost band over adjacent buildings)
Game.prototype.selectionOutline = function() {
  var shown = this.inspectCard && this.inspectCard.inspection;
  if (!shown || this.inputStatus.currentTool !== null)
    return null;
  if (shown.path && shown.path.length > 1)
    return null;
  var rect = shown.rect;
  return {tile: {x: rect.x + (rect.width > 1 ? 1 : 0), y: rect.y + (rect.height > 1 ? 1 : 0)}, size: rect.width,
          colour: '#8fdcff'};
};


// What the satisfaction scores read besides the map (src/objects/satisfaction.ts)
Game.prototype.satisfactionContext = function() {
  return {blockMaps: this.simulation.blockMaps, budget: this.simulation.budget, valves: this.simulation._valves,
          services: this.simulation._serviceLevels};
};


// The city map's overlays: the simulation's block maps, and how content each building is (its satisfaction layer)
Game.prototype.mapOverlays = function() {
  var map = this.gameMap, context = this.satisfactionContext();
  this.core.objects.scan(map, this.simulation._cityTime);
  var scores = new Int16Array(map.width * map.height).fill(-1);
  this.core.objects.all().forEach(function(object) {
    var satisfaction = object.satisfaction(map, context);
    if (!satisfaction)
      return;
    for (var y = object.top; y < object.top + object.size; y++)
      for (var x = object.left; x < object.left + object.size; x++)
        if (x >= 0 && y >= 0 && x < map.width && y < map.height)
          scores[y * map.width + x] = satisfaction.score;
  });
  var overlays = Object.create(this.simulation.blockMaps);
  overlays.satisfaction = function(x, y) {
    var score = scores[y * map.width + x];
    return score < 0 ? null : score;
  };
  return overlays;
};


// ... from a click at (x, y) pixels over the city
Game.prototype.inspectAtPixel = function(x, y) {
  var tile = this.cityView.tileAt(x, y);
  if (tile)
    this.inspectTile(tile.x, tile.y);
};


// The city as a save keeps it: from the core (src/core/cityCore.ts save) its records, objects, tools and simulation;
// then what only the game keeps
Game.prototype.saveData = function() {
  return Object.assign(this.core.save(), {
    name: this.name, everClicked: this.everClicked,
    provinceId: this.provinceId, districtId: this.districtId || undefined, worldId: this.worldId,
    rulerRank: this.rulerRank,
    goals: this.rulerGoals.state(), news: this.newsLog.items()
  });
};


// Saves this city in its own slot (saveData: the city to keep, this one as it is by default). Returns false when the
// browser's storage is full.
Game.prototype.save = function(saveData) {
  saveData = saveData || this.saveData();
  var date = this.simulation.getDate();
  try {
    this.cityId = saveCity(saveData, {
      name: this.name, provinceId: this.provinceId, districtId: this.districtId || undefined, worldId: this.worldId,
      population: this.simulation.evaluation.cityPop, funds: this.simulation.budget.totalFunds,
      year: date.year, month: date.month, rank: this.rulerRank
    }, this.cityId);
    this.lastSavedAt = Date.now();
    return true;
  } catch (e) {
    if (e instanceof StorageFullError)
      return false;
    throw e;
  }
};


// When the city owns land near the edge of the frame of its district it plays, the frame grows (src/cityFrame.ts,
// docs/DISTRICT_FRAME.md): the city is saved moved into the bigger frame, its new land from the district's map, and
// opens again on it (index.html?city=<id>), as a city opens from My cities. Nothing on a map that is not a frame.
Game.prototype.growFrame = function() {
  var map = this.gameMap, place = map.districtPlace;
  if (!map.frame || !place || !map.landBlocks || !this.districtId || this.growingFrame)
    return;
  var to = grownFrame(map.frame, map.landBlocks, place, DISTRICT_BLOCK);
  if (to === null)
    return;
  this.growingFrame = true;
  showCornerNote(t('land.note.opening'), 20000);
  var self = this, from = map.frame;
  fetch('data/maps/district/' + this.districtId + '.json').then(function(response) {
    if (!response.ok)
      throw new Error(response.status + ' ' + response.statusText);
    return response.json();
  }).then(function(whole) {
    return framePreset(whole, to);
  }).then(function(framed) {
    var moved = reframeSave(self.saveData(), from, to, freshFrame(framed), DISTRICT_BLOCK);
    // The autosave must not put the old frame back as the page goes
    self.autosave.stop();
    if (!self.save(moved))
      throw new Error('storage full');
    window.location.assign(window.location.pathname + '?city=' + encodeURIComponent(self.cityId));
  }).catch(function(error) {
    self.growingFrame = false;
    console.warn('Could not open more of the district: ' + error.message);
    showCornerNote(t('land.note.open_failed', {reason: error.message}), 8000);
  });
};


Game.prototype.load = function(saveData) {
  // The core has loaded the city itself (src/core/cityCore.ts); the game keeps its name and whether it was clicked
  this.name = saveData.name;
  this.everClicked = saveData.everClicked;
};


// The rank's name in the info bar, in the player's language
Game.prototype.showRulerRank = function() {
  $('#rulerRank').text(t('rank.' + this.rulerRank));
};


var nextFrame =
  window.requestAnimationFrame ||
  window.mozRequestAnimationFrame ||
  window.webkitRequestAnimationFrame;


Game.prototype.revealControls = function() {
 $('.initialHidden').each(function(e) {
   $(this).removeClass('initialHidden');
 });

 // A greeting each time the city opens, so not kept in the city's news
 this._notificationBar.news({subject: Messages.WELCOME}, true);
 this.rci.update({residential: 750, commercial: 750, industrial: 750});
};


var genericDialogClosure = function() {
  this.dialogOpen = false;
  this._openWindow = null;
};


Game.prototype.onDateChange = function(date) {
  // Building older than two months can no longer be undone
  this.refreshUndo();
  // The ruler's house may have fallen, or a new city's house now holds (src/rulerHouse.ts)
  this.refreshHouse();

  // Snow tiles exist only in the 2D view
  if (this.cityView.kind !== '2d')
    return;

  if (date.month === 10 && Random.getChance(10))
    this.cityView.canvas.changeTileSet(this.snowTileSet);
  else if (date.month === 1)
    this.cityView.canvas.changeTileSet(this.tileSet);
};


Game.prototype.handleDisasterWindowClosure = function(request) {
  this.dialogOpen = false;

  if (request === DisasterWindow.DISASTER_NONE)
    return;

  var disasters = {};
  disasters[DisasterWindow.DISASTER_MONSTER] = 'monster';
  disasters[DisasterWindow.DISASTER_FIRE] = 'fire';
  disasters[DisasterWindow.DISASTER_FLOOD] = 'flood';
  disasters[DisasterWindow.DISASTER_CRASH] = 'crash';
  disasters[DisasterWindow.DISASTER_MELTDOWN] = 'meltdown';
  disasters[DisasterWindow.DISASTER_TORNADO] = 'tornado';

  this.applyCommand({type: 'disaster', disaster: disasters[request]});
};


// On a map painted a cell at a time every building stands beside a road (src/cityCommands.ts besideRoad): the tile a
// building of size tiles at the mouse's tile goes to, the nearest whose tiles touch a road without covering one, so
// it lands where its outline (turned against the road in the 3D view) showed; the tile itself elsewhere
Game.prototype.buildingTile = function(tile, size) {
  var map = this.gameMap;
  var isRoad = function(x, y) { return map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y)); };
  // A bus goes on the nearest road tile, as the road drawn smooth does not always lie on its tiles (src/busStopTool.ts)
  var tools = this.inputStatus.gameTools, current = tools && tools[this.inputStatus.toolName];
  if (tile !== null && current && (current.busTool || this.inputStatus.toolName === UPGRADE_TOOL)) {
    var reach = current.busTool ? 3 : 1;
    var road = null, roadDistance = Infinity;
    for (var ry = -reach; ry <= reach; ry++)
      for (var rx = -reach; rx <= reach; rx++)
        if (rx * rx + ry * ry < roadDistance && isRoad(tile.x + rx, tile.y + ry)) {
          roadDistance = rx * rx + ry * ry;
          road = {x: tile.x + rx, y: tile.y + ry};
        }
    return road || tile;
  }
  // A one-tile building too (owner, 15 Oct 2026: "tool ทุก tool จะต้อง snap กับ ถนน")
  if (!map.cellZones || tile === null || !(size >= 3 || size === 1 && this.placesBuilding()))
    return tile;
  // A bigger building's tile is its centre, one in from its top left; a one-tile building's is itself
  var offset = size > 1 ? 1 : 0;
  var beside = size > 1 ? function(x, y) { return besideRoad(map.width, map.height, isRoad, x, y, size); } :
    function(x, y) { return isRoad(x - 1, y) || isRoad(x + 1, y) || isRoad(x, y - 1) || isRoad(x, y + 1); };
  var best = null, bestDistance = Infinity;
  for (var dy = -3; dy <= 3; dy++) {
    for (var dx = -3; dx <= 3; dx++) {
      var x = tile.x + dx, y = tile.y + dy, clear = true;
      for (var ty = y - offset; ty < y - offset + size && clear; ty++)
        for (var tx = x - offset; tx < x - offset + size && clear; tx++)
          clear = map.testBounds(tx, ty) && !isRoad(tx, ty);
      if (!clear || !beside(x, y))
        continue;
      var distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestDistance = distance; best = {x: x, y: y}; }
    }
  }
  return best || tile;
};


// The cells a rectangle dragged from one point to another (canvas pixels) paints: those inside it or along the stroke
// that the drag reaches without crossing a road (owner, 15 Oct 2026: "จุดวาด ห้ามข้ามถนน สิ"), expanded to full 4-row lot depth
Game.prototype.cellsInArea = function(from, to) {
  var a = this.cityView.pointAt(from.x, from.y);
  var b = this.cityView.pointAt(to.x, to.y) || a;
  if (a === null)
    return [];
  var layout = this.cellLayout();
  var u = layout.cellUnits, pad = u * 0.65;
  var sx = a.x * 10, sz = a.y * 10, ex = b.x * 10, ez = b.y * 10;
  var x0 = Math.min(sx, ex) - pad, x1 = Math.max(sx, ex) + pad, z0 = Math.min(sz, ez) - pad, z1 = Math.max(sz, ez) + pad;
  // The roads' pieces within the rectangle, which a cell's way from the reference point must not cross
  var pieces = [];
  var lines = this.networkLines(false);
  lines.forEach(function(line) {
    for (var i = 1; i < line.length; i++) {
      var p = line[i - 1], q = line[i];
      if (Math.max(p[0], q[0]) >= x0 - 2 && Math.min(p[0], q[0]) <= x1 + 2 &&
          Math.max(p[1], q[1]) >= z0 - 2 && Math.min(p[1], q[1]) <= z1 + 2)
        pieces.push([p[0], p[1], q[0], q[1]]);
    }
  });
  // If the drag started right on the road centerline and pulled outward into a lot, measure road-crossing from the end point
  var startOnRoad = nearestOnLines(lines, sx, sz, 4.5) !== null;
  var endOnRoad = nearestOnLines(lines, ex, ez, 4.5) !== null;
  var rx = startOnRoad && !endOnRoad ? ex : sx, rz = startOnRoad && !endOnRoad ? ez : sz;
  var side = function(ax, az, bx, bz, cx, cz) { return (bx - ax) * (cz - az) - (bz - az) * (cx - ax); };
  var crosses = function(cx, cz) {
    if (startOnRoad && endOnRoad) return false;
    for (var k = 0; k < pieces.length; k++) {
      var r = pieces[k];
      var d1 = side(rx, rz, cx, cz, r[0], r[1]), d2 = side(rx, rz, cx, cz, r[2], r[3]);
      var d3 = side(r[0], r[1], r[2], r[3], rx, rz), d4 = side(r[0], r[1], r[2], r[3], cx, cz);
      if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0) && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0)
        return true;
    }
    return false;
  };
  var seedCells = layout.cells.filter(function(cell) {
    return cell.x >= x0 && cell.x <= x1 && cell.z >= z0 && cell.z <= z1 && !crosses(cell.x, cell.z);
  });
  // Also include cells along the direct stroke between from and to (so a single click or a drag parallel to a road works)
  var strokeKeys = cellsAlong(layout, this.gameMap.width, [sx, sz], [ex, ez]);
  strokeKeys.forEach(function(k) {
    var idx = layout.byKey.get(k);
    if (idx !== undefined && !crosses(layout.cells[idx].x, layout.cells[idx].z))
      seedCells.push(layout.cells[idx]);
  });
  if (!seedCells.length)
    return [];
  // Expand every touched road column to all 4 rows deep (rows 0..3) so painted strips always form valid buildable plots
  var isSmallClick = Math.hypot(ex - sx, ez - sz) < u * 1.5;
  var alongTol = isSmallClick ? u * 2.1 : u * 0.65;
  var outKeys = [], seen = {};
  seedCells.forEach(function(c) {
    layout.cells.forEach(function(other) {
      if (other.road === c.road && (other.nx * c.nx + other.nz * c.nz) > 0.5 &&
          Math.hypot(other.x - (c.x + c.nx * (other.row - c.row) * u),
                     other.z - (c.z + c.nz * (other.row - c.row) * u)) <= alongTol) {
        if (!seen[other.key]) {
          seen[other.key] = true;
          outKeys.push(other.key);
        }
      }
    });
  });
  return outKeys;
};


// On a map whose zones go a cell at a time (owner, 14 Oct 2026; src/zoneCells.ts), the zone brushes and the eraser
// paint the 4 m cells along the roads rather than whole tiles
Game.prototype.isCellBrush = function(toolName) {
  return this.gameMap.cellZones === true && isPaintTool(toolName) && typeof this.cityView.pointAt === 'function';
};


// The cells along the roads, on land the city may build on: the same layout the commands check against
Game.prototype.cellLayout = function() {
  var map = this.gameMap;
  var inside = canBuildIn(map);
  return cellsOf(map, function(x, y) { return ownsLand(map, x, y) && inside(x, y); });
};


// Paints the cells (their keys) with the brush in hand, or clears them with the eraser, as one command
Game.prototype.paintCells = function(cells, screenX) {
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tool === null || cells.length === 0)
    return;
  var zone = null;
  PLOT_KINDS.forEach(function(kind) {
    if (PAINT_TOOLS[kind] === toolName)
      zone = kind;
  });
  var outcome = this.applyCommand({type: 'zoneCells', zone: zone, cells: cells});
  this.gameAudio.toolUsed(toolName, outcome.accepted ? tool.TOOLRESULT_OK : tool.TOOLRESULT_FAILED, screenX);
};


// A press or a drag of the brush: the full road-fronting lot(s) along the road from where it last was to where it is now
Game.prototype.paintCellStroke = function(data) {
  var point = this.cityView.pointAt(data.x, data.y);
  if (point === null)
    return;
  var world = [point.x * 10, point.y * 10];
  var last = this._cellStroke && this._cellStroke.stroke === data.stroke ? this._cellStroke.point : null;
  this._cellStroke = {stroke: data.stroke, point: world};
  var layout = this.cellLayout();
  var rawKeys = cellsAlong(layout, this.gameMap.width, last, world);
  if (!rawKeys.length)
    return;
  var mode = drawModeOf(this.inputStatus.toolName);
  // In 'fill' (เติม) mode, fill the entire contiguous side of this road stretch
  if (mode === 'fill') {
    var firstIdx = layout.byKey.get(rawKeys[0]);
    if (firstIdx !== undefined) {
      var ref = layout.cells[firstIdx];
      var fillKeys = layout.cells.filter(function(other) {
        return other.road === ref.road && (other.nx * ref.nx + other.nz * ref.nz) > 0.5;
      }).map(function(other) { return other.key; });
      if (fillKeys.length) {
        this.paintCells(fillKeys, data.x);
        return;
      }
    }
  }
  // Expand each touched cell to all cells in its road-fronting plot tile (all 4 rows deep along the road)
  var fullLotKeys = [];
  var seenKey = {};
  rawKeys.forEach(function(k) {
    var idx = layout.byKey.get(k);
    if (idx === undefined)
      return;
    var c = layout.cells[idx];
    // Include all cells on the same road side within 1 plot width (5 world units) and full depth (rows 0..3)
    layout.cells.forEach(function(other) {
      if (other.road === c.road && (other.nx * c.nx + other.nz * c.nz) > 0.5 &&
          Math.hypot(other.x - (c.x + c.nx * (other.row - c.row) * layout.cellUnits),
                     other.z - (c.z + c.nz * (other.row - c.row) * layout.cellUnits)) <= layout.cellUnits * 2.1) {
        if (!seenKey[other.key]) {
          seenKey[other.key] = true;
          fullLotKeys.push(other.key);
        }
      }
    });
  });
  this.paintCells(fullLotKeys.length ? fullLotKeys : rawKeys, data.x);
};


// The ruler's house level a school, a hospital, a building's level or its upgrade needs (src/services.ts,
// src/buildingLevels.ts)
var houseNeeded = function(map, toolName, x, y) {
  if (SERVICE_SPECS[toolName])
    return SERVICE_SPECS[toolName].house;
  var found = levelOfTool(toolName);
  if (found)
    return levelSpec(found.group, found.level).house;
  var next = toolName === BUILDING_UPGRADE_TOOL ? upgradeAt(map, x, y) : null;
  return next ? levelSpec(next.group, next.level).house : 0;
};


// The three.js view (docs/3d/RENDERER_SPEC.md section 3) on the live city, which it only reads.
// null when it fails to start (e.g. no WebGL): the game then uses the 2D view and says why.
var createView3D = function(game, view3d) {
  var simulation = game.simulation;
  var maps = simulation.blockMaps;
  try {
    return view3d.create({
      container: document.getElementById('canvasContainer'),
      map: game.gameMap,
      region: view3d.region,
      // Each road's look from its level (src/roadLevels.ts): laterite, asphalt, or concrete for the wider ones; the
      // view has three looks until it draws every level (docs/3d/CODEX_PROMPTS.md RD1)
      roadLevel: function(x, y) {
        var level = roadLevelAt(game.gameMap, x, y);
        return level <= 1 ? 1 : level === 2 ? 2 : 3;
      },
      // How hard the season's wind blows here, for the trees (src/wind.ts)
      windLevel: simulation.resources && typeof simulation.resources.wind === 'number' ? simulation.resources.wind : 2,
      overlays: {
        trafficDensityMap: maps.trafficDensityMap,
        pollutionDensityMap: maps.pollutionDensityMap,
        landValueMap: maps.landValueMap
      },
      date: function() { return simulation.getDate(); },
      // Street names along the roads, in the player's language (src/streetNames.ts)
      streetName: function(street) {
        var label = streetLabel(street, getLanguage());
        return t(label.key, label.params);
      },
      // The whole province round a district's city, for zooming out over it (src/splashScreen.js)
      province: game.gameMap.provinceBackdrop || null
    });
  } catch (e) {
    console.warn('The 3D city view could not start:', e);
    showCornerNote(t('view.3d_failed'), 8000);
    return null;
  }
};


// The one way the player changes the city (src/cityCommands.ts)
Game.prototype.applyCommand = function(command) {
  // Through the core, which keeps a log of the commands it accepts (src/core/cityCore.ts)
  var outcome = this.core.apply(command);
  if (outcome.accepted)
    this._edits = (this._edits || 0) + 1;
  // Land bought near the edge of the frame of its district the city plays opens more of it (docs/DISTRICT_FRAME.md)
  if (outcome.accepted && command.type === 'land')
    this.growFrame();
  // Building outside the province, or a plant the province cannot have, is refused all the time, and says so where
  // the player looks (handleTool)
  if (!outcome.accepted && [OUTSIDE_PROVINCE, NO_RESOURCE, NEEDS_WATER, NEEDS_HOUSE_LEVEL, NEEDS_RAIL, ONE_HSR,
                            TRANSIT_NEEDS_RANK].indexOf(outcome.reason) === -1 &&
      HOUSE_REASONS.indexOf(outcome.reason) === -1 && LAND_REASONS.indexOf(outcome.reason) === -1 && command.type !== 'wing')
    console.warn('Command refused: ' + outcome.reason, command);
  return outcome;
};


// The ruler's house (src/rulerHouse.ts): its button's places (build it, raise it a level, its wings), the tools a new
// city holds back until it stands, and the planning office's cheaper roads
var HOUSE_COLOUR = '#c9a227';
var SERVICE_COLOURS = {basic: '#e07b39', higher: '#b8612a', health: '#3aa17e'};

Game.prototype.refreshHouse = function() {
  var map = this.gameMap;
  var standing = houseStanding(map);
  var rank = Math.max(0, RANKS.indexOf(this.rulerRank));
  var level = standing ? map.rulerHouse.level : 0;
  var next = Math.min(level + 1, MAX_HOUSE_LEVEL);
  var game = this;
  setToolChoices(HOUSE_TOOL, [
    {tool: HOUSE_TOOL, available: !standing, colour: HOUSE_COLOUR, reason: 'house.reason.built'},
    {tool: HOUSE_UPGRADE_TOOL, available: standing && level < MAX_HOUSE_LEVEL && houseSpec(next).rank <= rank,
     colour: HOUSE_COLOUR, note: 'house.next.' + next,
     reason: !standing ? 'house.reason.none' : level >= MAX_HOUSE_LEVEL ? 'house.reason.top' :
             'house.reason.rank.' + houseSpec(next).rank},
    {tool: 'ruler_house_wings', available: standing, colour: HOUSE_COLOUR, note: 'house.wings_note',
     reason: 'house.reason.none', action: function() { game.openHouseWindow(); }},
    // The ruler's policies (src/policies.ts)
    {tool: 'ruler_house_policies', available: standing, colour: HOUSE_COLOUR, note: 'house.wings_note',
     reason: 'house.reason.none', action: function() { game.openPolicyWindow(); }}
  ]);
  // Schools and hospitals, the higher ones for a higher house (src/services.ts)
  var serviceChoice = function(kind) {
    var spec = SERVICE_SPECS[kind];
    return {tool: kind, available: spec.house <= level, colour: SERVICE_COLOURS[spec.field],
            reason: 'service.reason.house.' + spec.house};
  };
  setToolChoices('primary_school', EDUCATION_TOOLS.map(serviceChoice));
  setToolChoices('health_centre', HEALTH_TOOLS.map(serviceChoice));
  // Police and fire by level, the higher ones for a higher house, and the upgrade that raises a building a level
  // (src/buildingLevels.ts)
  var levelChoices = function(group, colour) {
    return LEVEL_GROUPS[group].levels.map(function(spec) {
      return {tool: spec.tool, available: spec.house <= level, colour: colour, reason: 'service.reason.house.' + spec.house};
    });
  };
  setToolChoices('police', levelChoices('police', pageChoice('police').colour)
    .concat(levelChoices('fire', pageChoice('fire').colour))
    .concat([{tool: BUILDING_UPGRADE_TOOL, available: true, colour: '#d9a400', note: 'choice.upgrade_note'}]));
  // Public transport, the metro and the high-speed rail station for a higher rank (src/transit.ts)
  setToolChoices('bus_stop', TRANSIT_KINDS.map(function(kind) {
    var spec = TRANSIT_SPECS[kind];
    return {tool: kind, available: spec.rank <= rank, colour: TRANSIT_COLOURS[kind], size: kind === 'bus_stop' ? 1 : 3,
            reason: 'house.reason.rank.' + spec.rank};
  }));
  // A new city's other tools wait for the house (the commands refuse them too)
  document.body.classList.toggle('houseFirst', houseFirst(map));
  // The planning office takes a tenth off the roads and their upgrades
  this.applyPlanningDiscount(hasWing(map, 'planning_office') ? PLANNING_DISCOUNT : 1);
};


Game.prototype.applyPlanningDiscount = function(factor) {
  if (this._planningFactor === factor)
    return;
  this._planningFactor = factor;
  var rules = this.simulation.rules;
  var tools = this.inputStatus.gameTools;
  ROAD_TOOLS.concat([UPGRADE_TOOL]).forEach(function(name) {
    tools[name].costFactor = rules.cost[name] * factor;
  });
  this.refreshPrices();
};


// The tool buttons' prices: the province's, the planning office's cheaper roads, and the next block of land
Game.prototype.refreshPrices = function() {
  var factor = this._planningFactor || 1;
  var prices = toolPrices(this.simulation.rules);
  ROAD_TOOLS.concat([UPGRADE_TOOL]).forEach(function(name) {
    prices[name] = Math.max(1, Math.round(prices[name] * factor));
  });
  if (this.gameMap.landBlocks)
    prices.land = blockPrice(this.gameMap);
  // A painted tile costs a ninth of its zone (src/plots.ts)
  PLOT_KINDS.forEach(function(kind) {
    prices[PAINT_TOOLS[kind]] = Math.max(1, Math.round(prices[kind] * PAINT_PRICE_SHARE));
  });
  showToolPrices(prices);
};


Game.prototype.openPolicyWindow = function() {
  if (this.dialogOpen)
    return;
  this.dialogOpen = true;
  this._openWindow = 'policyWindow';
  this.policyWindow.open();
};


Game.prototype.openHouseWindow = function() {
  if (this.dialogOpen)
    return;
  this.dialogOpen = true;
  this._openWindow = 'houseWindow';
  this.houseWindow.open();
};


// What a refused house tool says where the player looks
var houseNote = function(reason, map) {
  if (reason === NEEDS_RANK) {
    var next = Math.min((map.rulerHouse ? map.rulerHouse.level : 0) + 1, MAX_HOUSE_LEVEL);
    return t('house.note.needs_rank', {rank: t('rank.' + RANKS[houseSpec(next).rank])});
  }
  return t(reason === HOUSE_FIRST ? 'house.note.first' : reason === HOUSE_STANDS ? 'house.note.stands' :
           reason === HOUSE_AT_TOP ? 'house.note.top' : reason === NEEDS_ROAD ? 'house.note.needs_road' :
           'house.note.none');
};


// The kinds of the power plants (src/powerPlants.ts) or mines (src/mining.ts) still standing, by their centre tile,
// for the save: field is the map's record, centre the centre tile they stand on
var plantsStanding = function(gameMap, field, centre) {
  var kinds = {};
  var record = gameMap[field] || {};
  Object.keys(record).forEach(function(index) {
    var i = Number(index);
    var x = i % gameMap.width;
    var y = (i - x) / gameMap.width;
    if (gameMap.testBounds(x, y) && gameMap.getTileValue(x, y) === centre)
      kinds[index] = record[index];
  });
  return kinds;
};


// Whether a tile may be built on: on a whole-province map only the province's own tiles may (src/cityCommands.ts)
var canBuildIn = function(gameMap) {
  return function(x, y) {
    var inside = gameMap.insideProvince;
    return !inside || inside[x + y * gameMap.width] === 1;
  };
};



Game.prototype.handleSettingsWindowClosure = function(actions) {
  this.dialogOpen = false;

  for (var i = 0, l = actions.length; i < l; i++) {
    var a = actions[i];

    switch (a.action) {
      case SettingsWindow.AUTOBUDGET:
        this.applyCommand({type: 'setting', setting: 'autoBudget', on: a.data});
        break;

      case SettingsWindow.AUTOBULLDOZE:
        this.applyCommand({type: 'setting', setting: 'autoBulldoze', on: a.data});
        break;

      case SettingsWindow.SPEED:
        this.defaultSpeed = a.data;
        this.applyCommand({type: 'speed', speed: this.defaultSpeed});
        break;

      case SettingsWindow.DISASTERS_CHANGED:
        this.applyCommand({type: 'setting', setting: 'disasters', on: a.data});
        break;

      default:
        console.warn('Unexpected action', a);
    }
  }
};


Game.prototype.handleDebugWindowClosure = function(actions) {
  this.dialogOpen = false;

  for (var i = 0, l = actions.length; i < l; i++) {
    var a = actions[i];

    switch (a.action) {
      case DebugWindow.ADD_FUNDS:
        this.applyCommand({type: 'debugFunds'});
        break;

      default:
        console.warn('Unexpected action', a);
    }
  }
};


Game.prototype.handleScreenshotWindowClosure = function(action) {
  this.dialogOpen = false;

  if (action === null)
    return;

  var dataURI;
  if (action === ScreenshotWindow.SCREENSHOT_VISIBLE)
    dataURI = this.cityView.screenshotVisible();
  else if (action === ScreenshotWindow.SCREENSHOT_ALL)
    dataURI = this.cityView.screenshotMap();

  this.dialogOpen = true;
  this._openWindow = 'screenshotLinkWindow';
  this.screenshotLinkWindow.open(dataURI);
};


Game.prototype.handleBudgetWindowClosure = function(data) {
  this.dialogOpen = false;

  if (!data.cancelled) {
    this.applyCommand({
      type: 'budget',
      tax: Number(data.taxPercent),
      road: Number(data.roadPercent),
      fire: Number(data.firePercent),
      police: Number(data.policePercent),
      yearEnd: this.simNeededBudget,
      comTax: Number(data.comTax),
      indTax: Number(data.indTax),
      waterFee: Number(data.waterFee),
      touristFee: Number(data.touristFee)
    });
    this.simNeededBudget = false;
  }
};


var makeWindowOpenHandler = function(winName, customFn) {
  customFn = customFn || null;

  return function() {
    if (this.dialogOpen) {
      console.warn('Request made to open ' + winName + ' window. There is a dialog open!');
      return;
    }

    this.dialogOpen = true;
    this._openWindow = winName + 'Window';
    var win = winName + 'Window';
    var data = [];

    if (customFn)
      data = customFn();

    this[win].open.apply(this[win], data);
  };
};


// Going back to the start screen reloads the page, which drops the running game cleanly
Game.prototype.handleMainMenuClosure = function(choice) {
  this.genericDialogClosure();
  if (choice === 'stay')
    return;

  // If the city could not be saved, stay and say so rather than lose it
  if (choice === 'save' && !this.save()) {
    this.handleSave();
    return;
  }
  // Leaving without saving must not be undone by the autosave when the page closes
  this.autosave.stop();
  window.location.assign(window.location.pathname);
};


Game.prototype.handleDebugRequest = makeWindowOpenHandler('debug');
Game.prototype.handleDisasterRequest = makeWindowOpenHandler('disaster');
Game.prototype.handleQueryRequest = makeWindowOpenHandler('query');
Game.prototype.handleScreenshotRequest = makeWindowOpenHandler('screenshot');


Game.prototype.handleMandatoryBudget = function() {
  this.simNeededBudget = true;
  this.handleBudgetRequest();
};


Game.prototype.handleTool = function(data) {
  var x = data.x;
  var y = data.y;

  // Which map tile was clicked? (null outside the map)
  var tileCoords = this.cityView.tileAt(x, y);

  if (tileCoords === null)
    return;

  // On a map painted a cell at a time, the zone brushes paint the cells along the roads (src/zoneCells.ts)
  if (this.isCellBrush(this.inputStatus.toolName)) {
    this.paintCellStroke(data);
    return;
  }

  var tool = this.inputStatus.currentTool;
  var toolName = this.inputStatus.toolName;
  var result;

  // A building on a map painted a cell at a time goes where its outline showed: slid along the road a cell at a time,
  // its tiles the nearest beside the road
  var pose = this.buildingPose(this.inputStatus.toolWidth - 0, x, y);
  if (pose !== null)
    tileCoords = {x: Math.floor(pose[0] / 10), y: Math.floor(pose[1] / 10)};
  tileCoords = this.buildingTile(tileCoords, this.inputStatus.toolWidth - 0);

  // A drag that skipped tiles (a quick mouse) fills the gap, so a road or a stroke of paint never breaks
  var last = this._strokeTile;
  this._strokeTile = {stroke: data.stroke, x: tileCoords.x, y: tileCoords.y};
  if (last && last.stroke === data.stroke && toolName !== 'query' && toolName !== 'land' &&
      Math.abs(last.x - tileCoords.x) + Math.abs(last.y - tileCoords.y) > 1) {
    var fill = toolName === UPGRADE_TOOL ? this.upgradeRoadPath([last, tileCoords]) : linePath(last, tileCoords);
    fill.slice(1, -1).forEach(function(tile) {
      this.applyCommand({type: 'tool', tool: toolName, x: tile.x, y: tile.y, stroke: data.stroke});
    }, this);
  }

  if (toolName === 'land') {
    // Buying a block of land is a command of its own (src/landBlocks.ts)
    var bought = this.applyCommand({type: 'land', x: tileCoords.x, y: tileCoords.y});
    if (bought.accepted) {
      this.refreshPrices();
      if (this.cityView.landChanged)
        this.cityView.landChanged();
      this.cancelDraft();
    } else {
      var rankNeeded = blocksByRank(this.gameMap).findIndex(function(n) { return n > (this.gameMap.landBought || 0); }, this);
      showCornerNote(t('land.note.' + LAND_KEYS[bought.reason], {
        rank: t('rank.' + RANKS[Math.max(0, rankNeeded)]), price: formatMoney(blockPrice(this.gameMap))}), OUTSIDE_NOTE_MS);
    }
    this.gameAudio.toolUsed('land', bought.accepted ? tool.TOOLRESULT_OK : tool.TOOLRESULT_FAILED, x);
    return;
  }

  if (toolName === 'query') {
    // Looking at a tile changes nothing, so it is not a command; the inspector's card shows it (src/inspect.ts)
    this.inspectTile(tileCoords.x, tileCoords.y);
    result = tool.TOOLRESULT_OK;
  } else {
    var command = {type: 'tool', tool: toolName, x: tileCoords.x, y: tileCoords.y, stroke: data.stroke};
    if (pose !== null)
      command.pose = pose;
    var outcome = this.applyCommand(command);
    result = outcome.toolResult;
    // On a map painted a cell at a time every building stands beside a road (src/cityCommands.ts)
    if (outcome.reason === NEEDS_ROAD_BESIDE) {
      showCornerNote(t('tool.needs_road'), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    if (outcome.reason === NO_RESOURCE || outcome.reason === NEEDS_WATER) {
      var kind = kindOfTool(toolName);
      var ore = mineKindOfTool(toolName);
      var resource = ore ? ore.replace(/[A-Z]/g, function(c) { return '_' + c.toLowerCase(); }) :
                     toolName === 'farm' ? 'farmland' : toolName === 'fishing' ? 'fishery' :
                     (kind === 'wind' ? 'wind' : 'hydro');
      showCornerNote(outcome.reason === NEEDS_WATER ? t(toolName === 'fishing' ? 'tool.needs_water_harbour' : 'tool.needs_water') :
                     t('tool.no_resource', {plant: t('tool.' + toolName, {price: ''}).trim(),
                                             resource: t('resource.level.' + resource)}),
                     OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    if (outcome.reason === LAND_LOCKED) {
      showCornerNote(t('land.note.locked'), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    if (outcome.reason === OUTSIDE_PROVINCE) {
      showCornerNote(t('tool.outside_province'), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    // A station beside a railway, the metro and high-speed rail for a higher rank, one high-speed station
    // (src/transit.ts)
    var transitNotes = {};
    transitNotes[NEEDS_RAIL] = 'transit.note.needs_rail';
    transitNotes[ONE_HSR] = 'transit.note.one_hsr';
    transitNotes[TRANSIT_NEEDS_RANK] = 'transit.note.needs_rank';
    if (transitNotes[outcome.reason]) {
      showCornerNote(t(transitNotes[outcome.reason], TRANSIT_SPECS[toolName] ?
        {rank: t('rank.' + RANKS[TRANSIT_SPECS[toolName].rank])} : {}), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    // A higher school or hospital waits for a higher ruler's house (src/services.ts)
    if (outcome.reason === NEEDS_HOUSE_LEVEL) {
      showCornerNote(t('service.note.needs_house', {level: houseNeeded(this.gameMap, toolName, tileCoords.x, tileCoords.y)}), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
    // The ruler's house first, only one, and its next level for a higher rank (src/rulerHouse.ts)
    if (HOUSE_REASONS.indexOf(outcome.reason) !== -1) {
      showCornerNote(houseNote(outcome.reason, this.gameMap), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
  }

  this.showToolResult(tool, result);
  this.gameAudio.toolUsed(toolName, result, x);
  this.refreshUndo();
  if (toolName === HOUSE_TOOL || toolName === HOUSE_UPGRADE_TOOL || toolName === 'bulldozer')
    this.refreshHouse();
};


Game.prototype.handleSave = function() {
  // The save window says whether it worked
  var saved = this.save();
  $('#saveContainer [data-i18n="save.message"]').text(t(saved ? 'save.message' : 'save.full'));
  this.dialogOpen = true;
  this._openWindow = 'saveWindow';
  this.saveWindow.open();
};


Game.prototype.handlePause = function() {
  // XXX Currently only offer pause and run to the user
  // No real difference among the speeds until we optimise
  // the sim
  this.isPaused = !this.isPaused;
  this.applyCommand({type: 'speed', speed: this.isPaused ? Simulation.SPEED_PAUSED : this.defaultSpeed});
};


Game.prototype.handleInput = function() {
  if (!this.dialogOpen) {
    // Handle keyboard movement

    if (this.inputStatus.left)
      this.cityView.moveWest();
    else if (this.inputStatus.up)
      this.cityView.moveNorth();
    else if (this.inputStatus.right)
      this.cityView.moveEast();
    else if (this.inputStatus.down)
      this.cityView.moveSouth();
  }

  if (this.inputStatus.escape) {
    // We need to handle escape, as InputStatus won't know what dialogs are showing
    if (this.dialogOpen) {
      this.dialogOpen = false;
      this[this._openWindow].close();
      this._openWindow = null;
    } else if (this.lineDraft !== null && this.lineDraft.points.length > 0) {
      // A line half drawn goes first; the tool stays in hand
      this.lineDraft = null;
      this.inputStatus.escape = false;
    } else
      this.inputStatus.clearTool();
  }
};


// Will be bound on construction
var touchListener = function(e) {
  window.removeEventListener('touchstart', this.touchListener, false);
  this._openWindow = 'touchWindow';
  this.dialogOpen = true;
  this.touchWindow.open();
};


Game.prototype.processFrontEndMessage = function(message) {
  var subject = message.subject;
  var d = new Date();

  if (Text.goodMessages[subject] !== undefined) {
    // A bigger city raises the ruler's rank; it is celebrated once, the first time each rank is earned
    var milestone = MILESTONES[subject];
    var promoted = false;
    if (milestone !== undefined) {
      var rank = keepHigherRank(this.rulerRank, rankForCityClass(milestone.cityClass));
      promoted = rank !== this.rulerRank;
      this.rulerRank = rank;
      this.showRulerRank();
      // A higher rank may let the ruler's house rise a level
      this.refreshHouse();
    }

    if (this.lastBadMessageTime === null || d - this.lastBadMessageTime > disasterTimeout) {
      this.lastBadMessageTime = null;
      this._notificationBar.goodNews(message);
    }

    if (promoted) {
      this.dialogOpen = true;
      this._openWindow = 'congratsWindow';
      this.congratsWindow.open(t('congrats.message_prefix', {name: this.name}) + ' ' +
                               t('congrats.milestone.' + milestone.name) + ' ' +
                               t('congrats.promoted', {rank: t('rank.' + this.rulerRank)}));
    }

    return;
  }

  // Show disaster if applicable (2D only; in 3D the news item's link takes the camera there)
  if (message.data && this.monsterTV !== null) {
    if (message.data.showable)
    this.monsterTV.show(message.data.x, message.data.y);
    else if (message.data.trackable)
    this.monsterTV.track(message.data.x, message.data.y, message.data.sprite);
  }

  if (Text.badMessages[subject] !== undefined) {
    this._notificationBar.badNews(message);
    if (Messages.DISASTER_MESSAGES.indexOf(message.subject) !== -1)
      this.lastBadMessageTime = d;
    return;
  }

  if (Text.neutralMessages[subject] !== undefined) {
    if (this.lastBadMessageTime === null || d - this.lastBadMessageTime > disasterTimeout) {
      this.lastBadMessageTime = null;
      this._notificationBar.news(message);
    }
    return;
  }

  console.warn('Unexpected message: ', subject);
};


// Whether the tool in hand puts a building down (src/gameTools.js placesBuilding), which stands against its road
Game.prototype.placesBuilding = function() {
  var name = this.inputStatus.toolName, tools = this.inputStatus.gameTools;
  return !!name && !!tools && placesBuilding(name, tools[name]);
};


// The tool's outline under the mouse, in map tiles (src/cityView.ts ToolHover), or null
Game.prototype.calculateMouseForPaint = function() {
  // The drawing tip shows again below while the mouse is on the map with a tool that draws by modes
  this.showDrawTip(null);
  if (this.inputStatus.mouseX === -1 || !(this.inputStatus.toolWidth > 0))
    return this.selectionOutline();

  var tile = this.cityView.tileAt(this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (tile === null)
    return null;

  // The inputStatus fields came from DOM attributes, so will be strings. Coerce back to numbers.
  var pose = this.buildingPose(this.inputStatus.toolWidth - 0, this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (pose !== null)
    tile = {x: Math.floor(pose[0] / 10), y: Math.floor(pose[1] / 10)};
  tile = this.buildingTile(tile, this.inputStatus.toolWidth - 0);
  var hover = {tile: tile, size: this.inputStatus.toolWidth - 0, colour: this.inputStatus.toolColour || 'yellow'};
  if (pose !== null)
    hover.pose = pose;
  // A building's outline is the building as it will stand: against its road, and at the size it is drawn, its real
  // size on a city map (src/render3d/city/tileModels.ts BUILDING_SCALE)
  if (this.placesBuilding()) {
    hover.building = true;
    hover.fill = realUnits(this.gameMap.tileSizeM) ? BUILDING_SCALE : 1;
  }
  // Buying land shows the whole block under the mouse (src/landBlocks.ts)
  var cityMap = this.gameMap;
  if (this.inputStatus.toolName === 'land') {
    hover.tile = blockOutlineTile(cityMap, tile.x, tile.y);
    hover.size = blockSizeOf(cityMap);
    if (ownsLand(cityMap, tile.x, tile.y))
      hover.colour = OUTSIDE_COLOUR;
    return hover;
  }
  // Red where the tool would reach outside the province, or land the city has not bought, which cannot be built on
  if (placeProblem({canBuildAt: canBuildIn(cityMap), ownsLand: function(x, y) { return ownsLand(cityMap, x, y); }},
                   tile.x, tile.y, hover.size) !== null)
    hover.colour = OUTSIDE_COLOUR;
  // ... and, on a map painted a cell at a time, a building not beside a road, which may not stand there
  // (src/cityCommands.ts besideRoad)
  if (cityMap.cellZones && (hover.building || hover.size >= 3) && !besideRoad(cityMap.width, cityMap.height, function(x, y) {
    return isRoadTile(cityMap.getTileValue(x, y));
  }, tile.x, tile.y, hover.size))
    hover.colour = OUTSIDE_COLOUR;

  // A zone brush on a map painted a cell at a time shows the cell under the mouse (src/zoneCells.ts)
  if (this.isCellBrush(this.inputStatus.toolName)) {
    hover.cellPoint = this.cityView.pointAt(this.inputStatus.mouseX, this.inputStatus.mouseY);
    // ... and, while a rectangle is dragged, every cell it will paint (handleToolArea)
    var cellDrag = this.inputStatus.areaDrag;
    if (cellDrag && hover.cellPoint) {
      // Worked out again only when the drag moves
      var dragKey = [cellDrag.from.x, cellDrag.from.y, cellDrag.to.x, cellDrag.to.y].join();
      if (this._cellDragKey !== dragKey) {
        this._cellDragKey = dragKey;
        this._cellDragCells = this.cellsInArea(cellDrag.from, cellDrag.to);
      }
      hover.cellKeys = this._cellDragCells;
    }
    return hover;
  }

  // A road or railway tool shows a small marker where it would start or end, on an existing line's middle when near
  // one (owner, 14 Oct 2026: "ช่อง tool ให้เล็กลงอีก ที่จะวาด และให้ snap กับ เส้นกลาง ของถนน")
  var roadLevel = ROAD_TOOLS.indexOf(this.inputStatus.toolName) + 1;
  var units = realUnits(cityMap.tileSizeM);
  if (roadLevel > 0) {
    hover.roadWidth = roadReach(roadLevel, units) * 2;
  } else if (this.inputStatus.toolName === 'rail') {
    hover.roadWidth = 3.2 * (units || 1);
  }
  var linePoint = this.linePoint(this.inputStatus.toolName, this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (linePoint !== null) {
    hover.linePoint = linePoint;
    var started = this.lineDraft && this.lineDraft.tool === this.inputStatus.toolName ? this.lineDraft.startPoint : null;
    hover.lineStart = started || null;
  }

  // Drawing by modes (src/drawModes.ts): the line, curve, grid, rectangle or fill it would build, and beside the
  // mouse what to click next and what it would cost
  var preview = this.drawPreview(tile);
  if (preview !== null && preview.tiles.length > 0) {
    hover.path = preview.tiles;
    hover.drawMode = preview.mode;
    // A road, railway or power line being drawn (including rectangle and grid road modes) uses road ribbons
    hover.line = preview.mode !== 'fill' && (preview.mode !== 'rectangle' || roadLevel > 0 || this.inputStatus.toolName === 'rail');
    // ... in the colour of what it builds: laterite, asphalt, concrete, railway (owner, 14 Oct 2026)
    if (hover.line && hover.colour !== OUTSIDE_COLOUR) {
      hover.colour = roadLevel === 1 ? '#d9824a' : roadLevel === 2 ? '#4a4f52' : roadLevel > 2 ? '#9a978f' :
                     this.inputStatus.toolName === 'rail' ? '#7a6f63' : DRAW_COLOUR;
    }
    // Every mode's preview is the very line it builds: the straight line or the curve through its points
    hover.straight = preview.mode === 'straight';
    hover.controls = preview.controls || null;
  }
  this.showDrawTip(preview);
  if (preview !== null)
    return hover;

  // While a zone tool drags an area, show every zone it will lay
  var drag = this.inputStatus.areaDrag;
  var centres = drag ? this.areaCentresFor(drag, hover.size) : null;
  if (centres !== null)
    hover.area = areaFootprint(centres, hover.size);
  return hover;
};


// The zone centres a dragged area lays ({from, to} in canvas pixels), or null when it does not start on the map
Game.prototype.areaCentresFor = function(drag, size) {
  var from = this.cityView.tileAt(drag.from.x, drag.from.y);
  if (from === null)
    return null;
  var to = this.cityView.tileAt(drag.to.x, drag.to.y) || from;
  return areaCentres(from, to, size);
};


// A click of a tool that draws by clicks (src/drawModes.ts): a point of a line or a curve, which draws once it has all
// its points and then goes on from its end, or a fill of painted zones
Game.prototype.handleToolPoint = function(data) {
  var tile = this.cityView.tileAt(data.x, data.y);
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tile === null || tool === null)
    return;
  if (this.isCellBrush(toolName)) {
    this.paintCellStroke(data);
    this.resetDraft();
    return;
  }
  var mode = drawModeOf(toolName);
  if (mode === 'fill') {
    this.applyTiles(fillRegion(this.gameMap, tile.x, tile.y, tool.plotKind || null), data.stroke, data.x);
    this.resetDraft();
    return;
  }
  var needed = POINTS_NEEDED[mode];
  if (!needed)
    return;
  var draft = this.lineDraft;
  if (draft === null || draft.tool !== toolName || draft.mode !== mode)
    draft = this.lineDraft = {tool: toolName, mode: mode, points: [], from: null};
  tile = this.snapTile(tile, toolName, draft).tile;
  // Where the line starts, on the middle of the road it leaves from, for its preview
  if (draft.points.length === 0)
    draft.startPoint = this.linePoint(toolName, data.x, data.y);
  draft.points.push(tile);
  if (draft.points.length < needed)
    return;
  var path = toolName === UPGRADE_TOOL ? this.upgradeRoadPath(draft.points) : curvePath(draft.points);
  this.applyTiles(path, data.stroke, data.x);
  this.resetDraft();
};


// Shortest path along existing 4-connected road tiles from points[0] to points[last] for UPGRADE_TOOL, so upgrading a
// slanted or curved road hits every tile of its staircase rather than skipping elbows with a Bresenham line
Game.prototype.upgradeRoadPath = function(points) {
  if (!points || points.length < 2)
    return points || [];
  var map = this.gameMap, w = map.width, h = map.height;
  var isRoad = function(x, y) { return x >= 0 && y >= 0 && x < w && y < h && isRoadTile(map.getTileValue(x, y)); };
  var snapRoad = function(pt) {
    if (isRoad(pt.x, pt.y)) return pt;
    for (var d = 1; d <= 2; d++)
      for (var dy = -d; dy <= d; dy++)
        for (var dx = -d; dx <= d; dx++)
          if (isRoad(pt.x + dx, pt.y + dy)) return {x: pt.x + dx, y: pt.y + dy};
    return pt;
  };
  var start = snapRoad(points[0]), goal = snapRoad(points[points.length - 1]);
  if (!isRoad(start.x, start.y) || !isRoad(goal.x, goal.y))
    return curvePath(points);
  var startIdx = start.y * w + start.x, goalIdx = goal.y * w + goal.x;
  if (startIdx === goalIdx)
    return [start];
  var prev = new Int32Array(w * h).fill(-1);
  prev[startIdx] = startIdx;
  var queue = [startIdx], head = 0, maxSteps = 4000;
  var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < queue.length && head < maxSteps) {
    var cur = queue[head++];
    if (cur === goalIdx) break;
    var cx = cur % w, cy = (cur - cx) / w;
    for (var k = 0; k < 4; k++) {
      var nx = cx + dirs[k][0], ny = cy + dirs[k][1];
      if (!isRoad(nx, ny)) continue;
      var ni = ny * w + nx;
      if (prev[ni] !== -1) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (prev[goalIdx] === -1)
    return curvePath(points);
  var out = [];
  for (var at = goalIdx; ; at = prev[at]) {
    out.push({x: at % w, y: Math.floor(at / w)});
    if (at === startIdx) break;
  }
  out.reverse();
  return out;
};


// The smooth middle lines of the roads, or the railways, kept until the city is next changed (src/roadGeometry.ts)
Game.prototype.networkLines = function(rail) {
  var cache = rail ? '_railLines' : '_roadLines';
  if (!this[cache] || this[cache].edits !== this._edits) {
    var map = this.gameMap;
    var levels = map.roadLevels;
    var network = networkOf({width: map.width, height: map.height,
      value: function(i) { return map.getTileValue(i % map.width, Math.floor(i / map.width)); },
      level: function(i) { return levels ? levels[i] || 1 : 1; }}, rail);
    // The lines as the 3D view draws them, one where a road runs on through a junction (src/roadGeometry.ts roadLines),
    // so a building stands against the road it sees
    var drawn = roadLines(network).lines;
    this[cache] = {edits: this._edits, lines: drawn.map(function(line) { return line.points; }),
                   levels: drawn.map(function(line) { return line.level; })};
  }
  return this[cache].lines;
};


// Where a building of size tiles goes at the pointer (x, y on the view) on a map painted a cell at a time: against the
// nearest road, slid along it a zone cell (2 m) at a time, turned to face it (owner, 14 Oct 2026: "จะขยับซ้ายหรือขวา
// ให้ขยับได้ ทีละช่อง ทุก object"): [x, z, rotation] in world units, or null
Game.prototype.buildingPose = function(size, x, y) {
  var map = this.gameMap;
  // Every tool that puts a building down, a one-tile one too (owner, 15 Oct 2026: "tool ทุก tool จะต้อง snap กับ ถนน")
  if (!map.cellZones || !this.placesBuilding() || typeof this.cityView.pointAt !== 'function')
    return null;
  var point = this.cityView.pointAt(x, y);
  if (point === null)
    return null;
  var px = point.x * 10, pz = point.y * 10;
  var lines = this.networkLines(false), levels = this._roadLines.levels;
  var best = null, bestDistance = size * 5 + 20;
  lines.forEach(function(line, n) {
    var along = 0;
    for (var i = 1; i < line.length; i++) {
      var ax = line[i - 1][0], az = line[i - 1][1], dx = line[i][0] - ax, dz = line[i][1] - az;
      var length = Math.hypot(dx, dz) || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (length * length)));
      var distance = Math.hypot(ax + dx * t - px, az + dz * t - pz);
      if (distance < bestDistance) { bestDistance = distance; best = {line: line, level: levels[n], along: along + t * length}; }
      along += length;
    }
  });
  if (best === null)
    return null;
  // A zone cell's step along the road, from the road's start
  var step = 2 * 10 / (map.tileSizeM || 16), want = Math.round(best.along / step) * step, along = 0;
  for (var i = 1; i < best.line.length; i++) {
    var ax = best.line[i - 1][0], az = best.line[i - 1][1], dx = best.line[i][0] - ax, dz = best.line[i][1] - az;
    var length = Math.hypot(dx, dz) || 1;
    if (along + length >= want || i === best.line.length - 1) {
      var t = Math.max(0, Math.min(1, (want - along) / length)), rx = ax + dx * t, rz = az + dz * t, tx = dx / length, tz = dz / length;
      var nx = -tz, nz = tx;
      if (nx * (px - rx) + nz * (pz - rz) < 0) { nx = -nx; nz = -nz; }
      var gap = roadReach(best.level, realUnits(map.tileSizeM)) + 0.6 + size * 5 * BUILDING_SCALE;
      return [Math.round((rx + nx * gap) * 100) / 100, Math.round((rz + nz * gap) * 100) / 100,
              Math.round(Math.atan2(-nx, -nz) * 1000) / 1000];
    }
    along += length;
  }
  return null;
};


// Where a road or railway tool would start or end at the pointer (x, y on the view), in tiles: on the middle line of
// one of its kind within a tile when there is one, else the ground under the pointer; null for other tools
Game.prototype.linePoint = function(toolName, x, y) {
  if (modeGroupOf(toolName) !== 'line' || toolName === 'wire' || typeof this.cityView.pointAt !== 'function')
    return null;
  var point = this.cityView.pointAt(x, y);
  if (point === null)
    return null;
  var near = snapOn() ? nearestOnLines(this.networkLines(toolName === 'rail'), point.x * 10, point.y * 10, 14) : null;
  return near ? {x: near[0] / 10, y: near[1] / 10} : point;
};


// Where a click of a line tool lands with snapping on (src/drawPaths.ts): onto a road, railway or power line of its
// kind within a tile, else along a straight or 45° line from the last point, else (a line's first point) onto the
// guideline a block of plots from a straight road beside it. guide says which.
Game.prototype.snapTile = function(tile, toolName, draft) {
  if (!snapOn())
    return {tile: tile, guide: null};
  var map = this.gameMap;
  var kind = toolName === 'rail' ? function(v) { return v >= RAILBASE && v <= LASTRAIL; } :
             toolName === 'wire' ? function(v) { return v >= POWERBASE && v <= LASTPOWER; } : isRoadTile;
  var snapped = snapPoint(tile, function(x, y) { return map.testBounds(x, y) && kind(map.getTileValue(x, y)); });
  if (snapped.guide === 'road')
    return {tile: snapped.point, guide: 'road'};
  var points = draft ? draft.points : [];
  if (points.length > 0) {
    var angled = snapAngle(points[points.length - 1], tile);
    return {tile: angled, guide: null};
  }
  return {tile: snapped.point, guide: snapped.guide};
};


// The way the road at a tile runs, for the angle a new line makes with it: across or down, or null
Game.prototype.roadWayAt = function(tile) {
  var map = this.gameMap;
  var road = function(x, y) { return map.testBounds(x, y) && isRoadTile(map.getTileValue(x, y)); };
  if (!road(tile.x, tile.y))
    return null;
  var across = road(tile.x - 1, tile.y) || road(tile.x + 1, tile.y);
  var down = road(tile.x, tile.y - 1) || road(tile.x, tile.y + 1);
  return across === down ? null : across ? {x: 1, y: 0} : {x: 0, y: 1};
};


Game.prototype.resetDraft = function() {
  this.lineDraft = null;
  this._cellStroke = null;
  this._strokeTile = null;
  this.showDrawTip(null);
};


// A right click puts the tool in hand down at once, with any line half drawn (owner, 14 Oct 2026: "คลิกขวา แล้ว ให้
// tool นั้นหาย ไปเลยได้ไหม"); a right drag still turns the camera, and Esc still takes a half-drawn line first
Game.prototype.cancelDraft = function() {
  this.resetDraft();
  this.inputStatus.clearTool();
};


// Builds along a drawn line or over a painted area: a command a tile, all one stroke so they undo together, with one
// sound and one note for the lot
Game.prototype.applyTiles = function(tiles, stroke, soundX) {
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tool === null || tiles.length === 0)
    return;

  var best = null;
  var refusal = null;
  var broke = false;
  tiles.forEach(function(tile) {
    if (!this.gameMap.testBounds(tile.x, tile.y))
      return;
    var outcome = this.applyCommand({type: 'tool', tool: toolName, x: tile.x, y: tile.y, stroke: stroke});
    if (!outcome.accepted && refusal === null)
      refusal = outcome.reason;
    var result = outcome.toolResult;
    if (result === tool.TOOLRESULT_NO_MONEY)
      broke = true;
    if (result !== null && result !== undefined && (best === null || result === tool.TOOLRESULT_OK))
      best = result;
  }, this);

  if (best !== tool.TOOLRESULT_OK && refusal !== null) {
    var note = refusal === OUTSIDE_PROVINCE ? t('tool.outside_province') : refusal === LAND_LOCKED ?
               t('land.note.locked') : HOUSE_REASONS.indexOf(refusal) !== -1 ? houseNote(refusal, this.gameMap) : null;
    if (note !== null)
      showCornerNote(note, OUTSIDE_NOTE_MS);
  }
  this.showToolResult(tool, broke ? tool.TOOLRESULT_NO_MONEY : best);
  this.gameAudio.toolUsed(toolName, best === null ? tool.TOOLRESULT_FAILED : best, soundX);
  this.refreshUndo();
};


// What the tool in hand would build if clicked or released now, by its mode, and what that would cost: {tiles, cost},
// or null for a tool without modes. Kept until the mouse, the clicks or the city change, as it is asked for often.
Game.prototype.drawPreview = function(tile) {
  var toolName = this.inputStatus.toolName;
  var mode = drawModeOf(toolName);
  if (mode === null)
    return null;
  var draft = this.lineDraft;
  if (draft !== null && (draft.tool !== toolName || draft.mode !== mode))
    draft = this.lineDraft = null;
  var drag = this.inputStatus.areaDrag;
  var key = [toolName, mode, tile.x, tile.y, this._edits, draft ? JSON.stringify(draft.points) : '',
             drag ? [drag.from.x, drag.from.y, drag.to.x, drag.to.y].join(',') : '', snapOn()].join('|');
  if (this._preview !== null && this._preview.key === key)
    return this._preview;

  var tiles = [];
  if (isAreaMode(mode)) {
    var from = drag ? this.cityView.tileAt(drag.from.x, drag.from.y) : null;
    if (from !== null) {
      var to = this.cityView.tileAt(drag.to.x, drag.to.y) || from;
      tiles = mode === 'grid' ? gridPath(from, to) : rectanglePath(from, to);
    }
  } else if (mode === 'fill') {
    tiles = fillRegion(this.gameMap, tile.x, tile.y, this.inputStatus.currentTool.plotKind || null);
  }
  var guide = null;
  var angle = null;
  var controls = null;
  if (POINTS_NEEDED[mode]) {
    var snap = this.snapTile(tile, toolName, draft);
    guide = snap.guide;
    if (draft !== null && draft.points.length > 0) {
      var points = draft.points.concat([snap.tile]);
      tiles = toolName === UPGRADE_TOOL ? this.upgradeRoadPath(points) : curvePath(points);
      controls = toolName === UPGRADE_TOOL ? null : points;
      var start = points[0], leaving = points[1];
      angle = joinAngle({x: leaving.x - start.x, y: leaving.y - start.y}, draft.from, this.roadWayAt(start));
    } else if (snap.tile.x !== tile.x || snap.tile.y !== tile.y) {
      // Where the first click would land
      tiles = [snap.tile];
    }
  }
  var step = POINTS_NEEDED[mode] ? (draft !== null ? draft.points.length : 0) : -1;
  // A drawn line's length on the ground, as the 3D view smooths its steps: along every fourth tile
  var metres = 0;
  if (POINTS_NEEDED[mode] && tiles.length > 1) {
    for (var i = 4; i < tiles.length + 3; i += 4) {
      var a = tiles[i - 4], b = tiles[Math.min(i, tiles.length - 1)];
      metres += Math.hypot(b.x - a.x, b.y - a.y);
    }
    metres *= this.gameMap.tileSizeM || 10;
  }
  this._preview = {key: key, tiles: tiles, cost: tiles.length > 0 ? this.estimateCost(tiles) : 0, mode: mode, step: step,
                   metres: metres, angle: angle, guide: guide, controls: controls};
  return this._preview;
};


// What the tool in hand would cost over these tiles, each tried on its own and put back (an estimate: tiles that
// would join up may cost a little less)
Game.prototype.estimateCost = function(tiles) {
  var tool = this.inputStatus.currentTool;
  var blockMaps = this.simulation.blockMaps;
  var total = 0;
  tiles.forEach(function(tile) {
    if (!this.gameMap.testBounds(tile.x, tile.y))
      return;
    tool.doTool(tile.x, tile.y, blockMaps);
    if (tool.result === tool.TOOLRESULT_OK)
      total += tool.totalCost();
    tool.clear();
  }, this);
  return total;
};


// Beside the mouse while drawing: what to click next, and how many tiles and how much the drawing would take
Game.prototype.showDrawTip = function(preview) {
  var tip = document.getElementById('drawTip');
  if (!tip)
    return;
  // A chip each, as Cities: Skylines shows them: the length, the price, the next click, how to stop
  var parts = [];
  if (preview !== null) {
    if (preview.angle !== null && preview.angle !== undefined && preview.tiles.length > 1)
      parts.push('∠ ' + preview.angle + '°');
    if (preview.guide)
      parts.push(t('draw.snap.' + preview.guide));
    if (preview.metres > 0)
      parts.push('↔ ' + (preview.metres >= 1000 ? t('draw.length_km', {km: (preview.metres / 1000).toFixed(1)}) :
                         t('draw.length', {metres: Math.round(preview.metres)})));
    if (preview.tiles.length > 0)
      parts.push(t('draw.cost', {count: preview.tiles.length, price: formatMoney(preview.cost)}));
    if (preview.step >= 0)
      parts.push(t('draw.step.' + preview.mode + '.' + preview.step));
    else if (preview.mode === 'fill' && preview.tiles.length === 0)
      parts.push(t('draw.step.fill'));
    if (preview.step > 0)
      parts.push(t('draw.cancel'));
  }
  var text = parts.join('\n');
  tip.hidden = text === '';
  if (text === '')
    return;
  if (tip.dataset.text !== text) {
    tip.dataset.text = text;
    tip.replaceChildren.apply(tip, parts.map(function(part) {
      var chip = document.createElement('span');
      chip.textContent = part;
      return chip;
    }));
  }
  var canvas = document.getElementById('MicropolisCanvas');
  var rect = canvas ? canvas.getBoundingClientRect() : {left: 0, top: 0};
  tip.style.left = Math.round(rect.left + this.inputStatus.mouseX + 18) + 'px';
  tip.style.top = Math.round(rect.top + this.inputStatus.mouseY + 20) + 'px';
};


// A zone tool's dragged area, released: a zone at each centre, all one stroke so they undo together
Game.prototype.handleToolArea = function(data) {
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tool === null)
    return;

  // A rectangle dragged with a zone brush on a map painted a cell at a time: every cell inside it on this side of the
  // roads (cellsInArea)
  if (this.isCellBrush(toolName)) {
    var keys = this.cellsInArea(data.from, data.to);
    if (keys.length)
      this.paintCells(keys, data.to.x);
    this.resetDraft();
    return;
  }

  // A grid of roads, or a rectangle of painted zones (src/drawModes.ts)
  var mode = drawModeOf(toolName);
  if (isAreaMode(mode)) {
    var from = this.cityView.tileAt(data.from.x, data.from.y);
    if (from === null) {
      this.resetDraft();
      return;
    }
    var to = this.cityView.tileAt(data.to.x, data.to.y) || from;
    this.applyTiles(mode === 'grid' ? gridPath(from, to) : rectanglePath(from, to), data.stroke, data.to.x);
    this.resetDraft();
    return;
  }

  var centres = this.areaCentresFor(data, this.inputStatus.toolWidth - 0);
  if (centres === null) {
    this.resetDraft();
    return;
  }

  // Zones that do not fit (water, buildings in the way) are skipped; one sound for the whole area
  var best = null;
  centres.forEach(function(centre) {
    if (centre.x < 0 || centre.y < 0 || centre.x >= this.gameMap.width || centre.y >= this.gameMap.height)
      return;
    var result = this.applyCommand({type: 'tool', tool: toolName, x: centre.x, y: centre.y,
                                    stroke: data.stroke}).toolResult;
    if (best === null || result === tool.TOOLRESULT_OK)
      best = result;
  }, this);

  if (best !== null)
    this.showToolResult(tool, best);
  this.gameAudio.toolUsed(toolName, best, data.to.x);
  this.refreshUndo();
  this.resetDraft();
};


// What the tool panel's title says after a tool was used
Game.prototype.showToolResult = function(tool, result) {
  if (result === tool.TOOLRESULT_NEEDS_BULLDOZE)
    $('#toolOutput').text(Text.toolMessages.needsDoze);
  else if (result === tool.TOOLRESULT_NO_MONEY)
    $('#toolOutput').text(Text.toolMessages.noMoney);
  else
    $('#toolOutput').text(t(this.inputStatus.currentTool !== null ? 'tool.put_down' : 'tool.header'));
};


// Undo (Ctrl+Z or the ↶ button): takes the last stroke of building back, tiles and money (src/undoHistory.ts)
Game.prototype.handleUndo = function() {
  var funds = this.simulation.budget.totalFunds;
  var outcome = this.applyCommand({type: 'undo'});
  if (outcome.undone)
    showCornerNote(t('undo.done', {refund: formatMoney(this.simulation.budget.totalFunds - funds)}), 3000);
  else
    showCornerNote(t('undo.nothing'), 3000);
  this.refreshUndo();
  this.refreshHouse();
};


Game.prototype.refreshUndo = function() {
  var button = document.getElementById('undoButton');
  if (button)
    button.disabled = !this.commands.canUndo();
};


// The sprites within a rectangle of map tiles, or null when there are none
Game.prototype.spritesIn = function(rect) {
  if (rect === null)
    return null;

  var spriteList = this.simulation.spriteManager.getSpritesInView(rect.x0, rect.y0,
    (rect.x1 - rect.x0 + 1) * SPRITE_UNITS_PER_TILE, (rect.y1 - rect.y0 + 1) * SPRITE_UNITS_PER_TILE);

  return spriteList.length === 0 ? null : spriteList;
};


var tick = function() {
  this.handleInput();

  if (this.dialogOpen) {
    window.setTimeout(this.tick, 33);
    return;
  }

  if (!this.simulation.isPaused() && !$('#tooSmall').is(':visible')) {
    // Run the sim
    this.core.tick();
  }

  window.setTimeout(this.tick, 33);
};


var commonAnimate = function() {
  if (this.dialogShowing) {
    nextFrame(this.animate);
    return;
  }

  if (!this.isPaused)
    this.simulation.spriteManager.moveObjects(this.simulation._constructSimData());

  // Run this once per animation frame (even when paused: you can still build when paused)
  this.mouse = this.calculateMouseForPaint();

  // The tiles that can take painted zones show along the roads while a brush or a road tool is in hand (src/plots.ts)
  // On a map painted a cell at a time its cells along the roads show with a road tool too, as Cities: Skylines shows
  // its zoning while roads are drawn (owner, 14 Oct 2026: "แต่ละช่อง เป็นไปตามแนวถนน")
  var toolName = this.inputStatus.toolName;
  var zoneGrid = this.gameMap.paintedZones === true && (showsZoneGrid(toolName) ||
    this.gameMap.cellZones === true && modeGroupOf(toolName) === 'line' && toolName !== 'rail' && toolName !== 'wire');
  if (zoneGrid !== this._zoneGrid && this.cityView.zoneGrid) {
    this._zoneGrid = zoneGrid;
    this.cityView.zoneGrid(zoneGrid);
  }

  this.cityView.paint(this.mouse, this.spritesIn(this.cityView.visibleTiles()), this.isPaused);
  if (!this._curtainFaded) {
    this._curtainFaded = true;
    fadeCurtain(false, 900);
  }

  if (this.monsterTV !== null) {
    var tv = this.monsterTV.canvas;
    var tvOrigin = tv.getTileOrigin();
    var tvLast = tv.getMaxTile();
    this.monsterTV.paint(this.spritesIn({x0: tvOrigin.x, y0: tvOrigin.y, x1: tvLast.x, y1: tvLast.y}), this.isPaused);
  }

  nextFrame(this.animate);
};


var debugAnimate = function() {
  var date = new Date();
  var elapsed = Math.floor((date - this.animStart) / 1000);

  if (elapsed > this.lastElapsed && this.frameCount > 0) {
    $('#fpsValue').text(Math.floor(this.frameCount/elapsed));
    this.lastElapsed = elapsed;
  }

  this.frameCount++;
  this.commonAnimate();
};


export { Game };
