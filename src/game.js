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
import { bindGraphicsQuality } from './graphicsQuality.ts';
import { BaseTool } from './baseTool.js';
import { DRAWN_TILE_M, tileMetres, unitsPerMetre } from './units.ts';
import { BudgetWindow } from './budgetWindow.js';
import { besideRoad, CityCommands, NEEDS_ROAD_BESIDE, NEEDS_WATER, NO_RESOURCE, OUTSIDE_PROVINCE, placeProblem } from './cityCommands.ts';
import { CityCore } from './core/cityCore.ts';
import { MODE_RULES, modeChoosable, modeRule, ONLINE_MODE, startingFundsIn } from './gameModes.ts';
import { siteMonths } from './construction.ts';
import { lockedTitle, lockOf, lockText, plainToolName } from './unlockLabels.ts';
import { showDemandAndPeople, showEra, showServices, showTourism, showTrained, showWaste } from './cityStatus.ts';
import { areaCentres, areaFootprint, SPRITE_UNITS_PER_TILE } from './cityView.ts';
import { createCityView2D } from './cityView2d.ts';
import { showCornerNote, showCornerNoteOnce } from './cornerNote.ts';
import { headingOf, meetAngle, nextText, pixelsPerTile, pointText, showZoom, snapWhy, strokeText, tileHeight } from './drawReadout.ts';
import { closeToolTray } from './toolDock.ts';
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
import { citySavesWritten, listCities, onCitySaveFailed, saveCity, StorageFullError } from './cityStorage.ts';
import { MapWindow } from './mapWindow.js';
import { toolPrices } from './provinceRules.ts';
import { canBuildKind, kindOfTool, POWER_KINDS, PLANT_TOOLS } from './powerPlants.ts';
import { canDig, MINE_KINDS, MINE_TOOLS, mineKindOfTool } from './mining.ts';
import { clearToolChoices, pageChoice, setToolChoices, toolChoicesFor } from './toolLevels.ts';
import { buildingAt, MOVE_NO_MONEY, MOVE_TOOL } from './moveTool.ts';
import { drawModeOf, isAreaMode, isFarmTool, isPaintTool, isStraightMode, modeGroupOf, POINTS_NEEDED, showsZoneGrid, snapOn } from './drawModes.ts';
import { FARM_ERASE_TOOL, FARM_PAINT_TOOL, fieldFillRegion, fieldOutcome } from './farmZone.ts';
import { FARM_ZONE } from './provinceRules.ts';
import { SCENE } from './theme/tokens.ts';
import { BRUSH_RADIUS_M, cellsAlong, cellsInStrip, cellsNear, cellsOf } from './zoneCells.ts';
import { nearestOnLines, networkOf, realUnits, roadLines, roadReach, smoothLine } from './roadGeometry.ts';
import { wholeRoadTiles } from './roads/wholeRoad.ts';
import { drawnRoads, graphLines } from './roads/graphLines.ts';
import { canalGraphLines } from './roads/canalLines.ts';
import { alongside, lineLength, lineOfPoints, lineOnGraph, linePrice, snapToRoads, snapWay } from './roads/roadDraw.ts';
import { placesBuilding } from './gameTools.js';
import { blockOf } from './buildings/placedBuildings.ts';
import { isTurned } from './buildings/turnedFootprint.ts';
import { layerPixels, toolLayer } from './cityMap.ts';
import { seasonWind } from './wind.ts';
import { BUILDING_SCALE } from './render3d/city/tileModels.ts';
import { aroundCorners, curvePath, END_SNAP_REACH, GRID_SPACING, gridLines, gridPath, joinAngle, linePath, MAX_SNAP_REACH, MIN_SNAP_REACH, rectanglePath,
  snapAlong, snapAngle, SNAP_DEGREES, snapPoint } from './drawPaths.ts';
import { dozeStroke, dozeTile, loneRoads } from './dozing.ts';
import { edgeScroll } from './edgeScroll.ts';
import { ERASE_TOOL, fillRegion, isOpenLand, PAINT_PRICE_SHARE, PAINT_TOOLS, PLOT_KINDS } from './plots.ts';
import { farmLevel, fisheryLevel } from './farming.ts';
import { relabelTools, showToolPrices, toolLabel } from './toolShortcuts.ts';
import { CIVIC, LASTPOWER, LASTRAIL, MINE, POWERBASE, POWERPLANT, RAILBASE, STATION, WASTE, WATER_HIGH, WATER_LOW } from './tileValues.ts';
import { NEEDS_RAIL, ONE_HSR, TRANSIT_KINDS, TRANSIT_NEEDS_RANK, TRANSIT_SPECS } from './transit.ts';
import { WASTE_KINDS } from './waste.ts';
import { HouseWindow } from './houseWindow.ts';
import { PolicyWindow } from './policyWindow.ts';
import { fadeCurtain } from './curtain.ts';
import { loadingFirstFrame } from './loadingScreen.ts';
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
import { canalMarkStands, isBridgeTile, isWaterTile } from './canals.ts';
import { streetLabel } from './streetNames.ts';
import { installMousePan, installViewControls, panOf, setViewHome } from './viewControls.ts';
import { focusDrawPoint, setDrawingLine } from './drawAssist.ts';
import { installCameraBar } from './cameraModes.ts';
import { installTimeControls } from './timeControls.ts';
import { DayClock } from './dayClock.ts';
import { skyAt } from './rainSpells.ts';
import { inspectAt } from './inspect.ts';
import { InspectCard } from './inspectCard.ts';
import * as Messages from './messages.ts';
import { MonsterTV } from './monsterTV.js';
import { installNewsLog } from './newsLog.ts';
import { installFestivalCard } from './festivalCard.ts';
import { NagWindow } from './nagWindow.js';
import { Notification } from './notification.js';
import { QueryWindow } from './queryWindow.js';
import { Random } from './random.ts';
import { RCI } from './rci.js';
import { installRulerGoals } from './rulerGoals.ts';
import { keepHigherRank, RANKS, rankForCityClass } from './rulerRank.ts';
import { eraForRank, isEra } from './era.ts';
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
  // A city of an online world is always normal (src/gameModes.ts); a saved city keeps the level it was saved with
  if (!modeChoosable(this.worldId))
    difficulty = MODE_RULES[ONLINE_MODE].level;
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

  // A new province city starts with that province's treasury (src/geo/provinceProfile.ts), and every new city with
  // more or less of it by its mode (src/gameModes.ts)
  if (!savedGame)
    this.simulation.budget.setFunds(startingFundsIn(gameMap.startingFunds || this.simulation.budget.totalFunds,
                                                    this.simulation._gameLevel));

  this.name = name || 'MyTown';
  this.everClicked = false;
  // The time of day (src/dayClock.ts): runs while the game runs, and the 3D view's sun follows it
  this.dayClock = new DayClock();
  this._clockAt = null;
  // ... and the sky now: the month's weather (src/weather.ts) with a rain spell now and then (src/rainSpells.ts), which
  // the 3D view, the time bar and the sounds show; the simulation keeps to the month's
  this.skyNow = null;

  if (savedGame)
    this.load(savedGame);

  // Every building as an object of its own (src/objects/), kept up by the core each month
  this.cityObjects = this.core.objects;

  // The ruler's rank follows the city's size and is never lost (src/rulerRank.ts); older saves have none yet
  this.rulerRank = keepHigherRank(savedGame ? savedGame.rulerRank : null,
                                  rankForCityClass(this.simulation.evaluation.cityClass));
  // The city's era comes from its era score (src/eraScore.ts, docs/GAME_DESIGN.md); a new city or one saved before
  // the score starts from the era of its rank. Renderers read it from the map (src/era.ts)
  if (!isEra(this.gameMap.era))
    this.gameMap.era = eraForRank(this.rulerRank);
  var eraGame = this;
  this.core.on('eraDawn', function(event) {
    eraGame._notificationBar.goodText(t('era.dawn', {era: t('era.name.' + event.era)}));
  });
  // What the city can build yet (src/unlocks.ts) changes with its era, its trained people and its finished buildings:
  // the year's graduates and a finished construction site make the news (docs/GAME_DESIGN.md 6)
  this.core.on('trained', function(event) {
    var g = event.graduates;
    var whole = function(n) { return Math.round(n).toLocaleString('en-US'); };
    if (g.technician + g.nurse + g.engineer + g.doctor >= 1) {
      eraGame._notificationBar.goodText(t('news.trained', {technician: whole(g.technician), nurse: whole(g.nurse),
        engineer: whole(g.engineer), doctor: whole(g.doctor)}));
    } else if (g.literate >= 1) {
      // ... a village's first classes, the villagers who read and write a market town needs (src/eraRules.ts)
      eraGame._notificationBar.goodText(t('news.trained_literate', {literate: whole(g.literate)}));
    }
    eraGame.refreshLocks();
  });
  this.core.on('siteDone', function(event) {
    eraGame._notificationBar.goodText(t('news.site_done', {name: plainToolName(event.tool)}));
    eraGame.refreshLocks();
  });
  this.core.on('month', function() { eraGame.refreshLocks(); });
  onLanguageChange(function() { eraGame.refreshLocks(); });
  this.core.on('era', function(event) {
    eraGame.refreshLocks();
    eraGame._notificationBar.goodText(t('congrats.era', {name: eraGame.name, era: t('era.name.' + event.era)}));
    if (!eraGame.dialogOpen) {
      eraGame.dialogOpen = true;
      eraGame._openWindow = 'congratsWindow';
      eraGame.congratsWindow.open(t('congrats.era', {name: eraGame.name, era: t('era.name.' + event.era)}));
    }
  });

  this.rci = new RCI('RCIContainer', this.simulation);
  // The same demand, as percentages with the people in homes, shops and factories, in the status (src/cityStatus.ts)
  showDemandAndPeople(this.simulation);
  showTourism(this.simulation);
  showServices(this.simulation);
  showWaste(this.simulation);
  showEra(this.core);
  showTrained(this.core);

  // What draws the city (src/cityView.ts); the game talks to it in map tiles only.
  // Note: must create the view before inputStatus, which listens to the view's canvas
  this.cityView = view3d ? createView3D(this, view3d) : null;
  if (this.cityView && this.cityView.relabelStreets)
    onLanguageChange(this.cityView.relabelStreets.bind(this.cityView));
  // A building standing with no pose kept (put down before poses were kept, or not by the mouse) keeps the way it stands
  // now, once the roads are drawn, so no road drawn later turns it (owner, 20 Oct 2026: "สิ่งก่อสร้างที่วาดแล้วห้ามขยับอีก")
  if (this.cityView && typeof this.cityView.buildingPoseOf === 'function') {
    var keeper = this;
    [3000, 10000, 30000].forEach(function(ms) { window.setTimeout(function() { keeper.keepBuildingPoses(); }, ms); });
  }
  if (this.cityView === null)
    this.cityView = createCityView2D('canvasContainer', this.gameMap, this.tileSet, spriteSheet);
  // The player's graphics setting (src/graphicsQuality.ts), kept for this browser: what the 3D view's diorama lens draws
  bindGraphicsQuality(this.cityView);
  this.inputStatus = new InputStatus(this.gameMap, tileSet.tileWidth, this.simulation.rules, this.core.tools);
  // A press dragged to its release draws a straight line at once only when no line is half drawn and it reaches two
  // tiles: a click that slips a little is still a click (owner, 18 Oct 2026: "คลิกจุด A และ B มันควรจะเริ่มจากจุด A ไปถึง B")
  var game = this;
  this.inputStatus.lineDragged = function(from, to) {
    if (game.lineDraft !== null && game.lineDraft.points.length > 0)
      return false;
    var a = game.cityView.tileAt(from.x, from.y), b = game.cityView.tileAt(to.x, to.y);
    return a !== null && b !== null && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) >= 2;
  };
  // The tool buttons show this province's prices
  this._planningFactor = 1;
  this.refreshPrices();
  // Buying land only where the map is cut into blocks (src/landBlocks.ts)
  var landButton = document.getElementById('landButton');
  if (landButton)
    landButton.hidden = !this.gameMap.landBlocks;
  // The farm zone is painted only where homes, shops and factories are (src/farmZone.ts)
  var farmZoneButton = document.getElementById('farmZoneButton');
  if (farmZoneButton)
    farmZoneButton.hidden = !this.gameMap.paintedZones;

  // Every change the player makes goes through this one entry point as a plain command (src/cityCommands.ts), which
  // the core builds the same way for every city (src/core/cityLayers.ts commandTarget)
  var simulation = this.simulation;
  var cityMap = this.gameMap;
  var game = this;
  this.commands = this.core.commands;

  // The power button's places above the tools are its kinds of plant, and the nuclear plant; those the province
  // cannot build wait
  game.setChoices('coal', POWER_KINDS.map(function(kind) {
    return {tool: PLANT_TOOLS[kind], available: canBuildKind(kind, simulation.resources), colour: PLANT_COLOURS[kind]};
  }).concat([pageChoice('nuclear')]));
  // Buttons that group tools (docs/TOOLS_PLAN.md): safety, water, farms and harbours, long-distance transport
  game.setChoices('waterworks', [pageChoice('waterworks'), pageChoice('watertower')]);
  game.setChoices('farm', [pageChoice('farm', farmLevel(simulation.resources) >= 1),
    pageChoice('fishing', fisheryLevel(simulation.resources) >= 1)]);
  game.setChoices('port', [pageChoice('port'), pageChoice('airport')]);
  // The rubbish button's places are its five buildings, the landfill first (src/waste.ts)
  game.setChoices('landfill', WASTE_KINDS.map(function(kind) {
    return {tool: kind, available: true, colour: WASTE_COLOURS[kind]};
  }));
  // The road button's places are its levels, and the upgrade tool that raises a road one level at a time
  game.setChoices('road', ROAD_TOOLS.map(function(tool) { return {tool: tool, available: true, colour: '#3a3a3a'}; })
    .concat([{tool: UPGRADE_TOOL, available: true, colour: '#d9a400', note: 'choice.upgrade_note'}]));
  // On a map whose buildings stand against their roads the bulldozer's places are the bulldozer and the move tool,
  // which slides a building along its road (src/moveTool.ts, docs/METRE_DRAWING_PLAN.md 2.5)
  if (cityMap.cellZones)
    game.setChoices('bulldozer', [pageChoice('bulldozer'),
      Object.assign(pageChoice(MOVE_TOOL), {note: 'choice.move_note'})]);
  else
    game.clearChoices('bulldozer');
  // On a map with painted zones the home, shop and factory buttons are brushes, with the eraser beside them
  PLOT_KINDS.forEach(function(kind) {
    if (!cityMap.paintedZones) {
      game.clearChoices(kind);
      return;
    }
    var button = document.querySelector('.toolButton[data-tool="' + kind + '"]');
    game.setChoices(kind, [
      {tool: PAINT_TOOLS[kind], available: true, colour: button ? button.getAttribute('data-colour') : undefined, size: 1},
      {tool: ERASE_TOOL, available: true, colour: ERASER_COLOUR, size: 1, note: 'choice.erase_note'}]);
  });
  // ... and the farm zone's brush, where the province has farmland, with its own eraser (src/farmZone.ts)
  if (cityMap.paintedZones)
    setToolChoices(FARM_PAINT_TOOL, [
      {tool: FARM_PAINT_TOOL, available: farmLevel(simulation.resources) >= 1, colour: FARM_COLOUR, size: 1},
      {tool: FARM_ERASE_TOOL, available: true, colour: ERASER_COLOUR, size: 1, note: 'choice.erase_note'}]);
  // The mine button's places are the ores the province has; those it lacks are left out
  game.setChoices('mine', MINE_KINDS.filter(function(kind) { return canDig(kind, simulation.resources); })
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
      // ... and the state's grant for each of the city's people (src/gameModes.ts)
      grantIncome: this.simulation.budget.grantIncome,
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
      transitCost: this.simulation.budget.transitCost,
      // ... and last year's festivals, paid in their months (src/festivals.ts)
      festivalCost: this.simulation.budget.festivalCost
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
  this.inputStatus.addEventListener(Messages.TOOL_PATH, this.handleToolPath.bind(this));
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

  // The province's festivals (src/festivalCard.ts, docs/GAME_DESIGN.md 5): a month before each the ruler is asked how
  // to hold it, as a command, and the news says how it was held
  this.festivalCard = installFestivalCard({
    on: function(type, listener) { return self.core.on(type, listener); },
    choiceOf: function(id) { return (self.gameMap.festivals && self.gameMap.festivals.choices[id]) || 'modest'; },
    funds: function() { return self.simulation.budget.totalFunds; },
    choose: function(id, scale) { return self.applyCommand({type: 'festival', id: id, scale: scale}).accepted; },
    news: function(text, good, at) {
      if (good)
        self._notificationBar.goodText(text);
      else
        self._notificationBar.badText(text, at ? at.x : undefined, at ? at.y : undefined);
    }
  });

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
  // ... and a save the city database could not write (the browser's storage full) says so too
  onCitySaveFailed(showFullNote);
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
  // The date and the game's speeds at the bottom left (src/timeControls.ts)
  installTimeControls(this);
  document.addEventListener('phaicity:active_tool_changed', function(event) {
    self.updateContextualOverlay(event.detail && event.detail.tool);
  });
  onLanguageChange(function() { if (self.inspectCard) self.inspectCard.render(); });
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && self.inspectCard && self.inspectCard.isOpen)
      self.inspectCard.close();
    // A building carried by the move tool turns 15 degrees a press where no road is near it (R, Shift+R the other way)
    if ((event.key === 'r' || event.key === 'R') && self.moving && self.inputStatus.toolName === MOVE_TOOL) {
      self.moving.turn += (event.shiftKey ? -1 : 1) * Math.PI / 12;
      event.preventDefault();
    }
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
  // Clicking empty land/woods/water while an object/road card is already open closes the card cleanly (an empty
  // painted plot is not plain ground: it has its checklist)
  var isPlainGround = found && ['object.kind.land', 'object.kind.woods', 'object.kind.water'].indexOf(found.title.key) !== -1 &&
                      !found.checklist;
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


// Contextual overlays when tools are armed (industrial -> pollution & wind, water -> groundwater, every mine -> toxic; src/cityMap.ts toolLayer)
Game.prototype.updateContextualOverlay = function(activeTool) {
  if (this.mapWindow && this.mapWindow.isOpen)
    return;

  var tool = activeTool || '';
  var targetLayer = toolLayer(tool);

  if (targetLayer && this.gameMap && this.cityView && typeof this.cityView.showLayer === 'function') {
    var width = this.gameMap.width, height = this.gameMap.height;
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(new ImageData(layerPixels(targetLayer, this.gameMap, this.mapOverlays()), width, height), 0, 0);
      this.cityView.showLayer(canvas);
    }

    if (tool === 'industrial' || tool === 'zone_industrial') {
      var date = this.simulation.getDate ? this.simulation.getDate() : { month: 0 };
      var wind = seasonWind(date.month, 2);
      var dirKey = wind.season === 'northeast_monsoon' ? 'wind.dir.sw' : wind.season === 'hot_season' ? 'wind.dir.n' : 'wind.dir.ne';
      showCornerNote(t('wind.hint.industrial', {
        season: t('wind.season.' + wind.season),
        dir: t(dirKey),
      }), 7000);
    } else if (tool === 'waterworks' || tool === 'watertower') {
      showCornerNote(t('dock.hint.groundwater'), 5000);
    } else if (targetLayer === 'toxic') {
      showCornerNote(t('dock.hint.toxic'), 5000);
    }
  } else if (!targetLayer && this.cityView && typeof this.cityView.showLayer === 'function') {
    this.cityView.showLayer(null);
  }
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
    goals: this.rulerGoals.state(), news: this.newsLog.items(),
    timeOfDay: Math.round(this.dayClock.hour * 1000) / 1000
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
    // ... and the page opens it again once it is written (src/cityStorage.ts)
    return citySavesWritten();
  }).then(function(written) {
    if (!written)
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
  // ... and the time of day it was saved at (a city saved before the clock wakes at seven)
  if (typeof saveData.timeOfDay === 'number')
    this.dayClock = new DayClock(saveData.timeOfDay);
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


// The bulldozer takes the road, railway or power line drawn under the mouse, goes over the mouse's whole way and takes a
// road tile left alone beside one it dozed (src/dozing.ts; owner, 18 Oct 2026). (x, y) are the mouse's pixels.
Game.prototype.dozeTile = function(tile, x, y) {
  var point = tile !== null && typeof this.cityView.pointAt === 'function' ? this.cityView.pointAt(x, y) : null;
  return tile === null ? tile : dozeTile(this.gameMap, tile, point, isOpenLand);
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
  if (!map.cellZones || tile === null || !(size >= 2 || size === 1 && this.placesBuilding()))
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


// The tile a building posed at pose ([x, z, turn], world units) is put down at: the centre of the block of size tiles
// round the tile its middle lies on (src/buildings/placedBuildings.ts blockOf)
var poseTile = function(pose, size) {
  var block = blockOf(pose[0], pose[1], size, 10);
  return {x: block.cx, y: block.cy};
};


// The cells a rectangle dragged from one point to another (canvas pixels) paints: those inside it or along the stroke
// that the drag reaches without crossing a road (owner, 15 Oct 2026: "จุดวาด ห้ามข้ามถนน สิ"), expanded to its plots' depth
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
  // Exactly the cells the rectangle reaches, row by row: a thin rectangle along a road paints one row of cells, a deeper
  // one more rows (owner, 18 Oct 2026: "ให้วาดได้ทีละแถวเรียงๆ กันไป"), not the whole plot's depth as it once did
  var outKeys = [], seen = {};
  seedCells.forEach(function(c) {
    if (!seen[c.key]) {
      seen[c.key] = true;
      outKeys.push(c.key);
    }
  });
  return outKeys;
};


// The farm zone's numbers in this province (src/provinceRules.ts FarmZoneSpec)
Game.prototype.farmZoneRules = function() {
  return (this.simulation.rules && this.simulation.rules.farmZone) || FARM_ZONE;
};


// The tiles a fill of the brush in hand paints: a zone's along its road (src/plots.ts), the farm zone's over the open
// land with a way to a road (src/farmZone.ts)
Game.prototype.paintFill = function(tile, toolName) {
  if (isFarmTool(toolName))
    return fieldFillRegion(this.gameMap, tile.x, tile.y, toolName === FARM_ERASE_TOOL, this.farmZoneRules().reach);
  return fillRegion(this.gameMap, tile.x, tile.y, this.inputStatus.currentTool.plotKind || null);
};


// On a map whose zones go a cell at a time (owner, 14 Oct 2026; src/zoneCells.ts), the zone brushes and the eraser
// paint the 4 m cells along the roads rather than whole tiles
Game.prototype.isCellBrush = function(toolName) {
  return this.gameMap.cellZones === true && isPaintTool(toolName) && !isFarmTool(toolName) &&
         typeof this.cityView.pointAt === 'function';
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
  if (!outcome.accepted && outcome.reason === HOUSE_FIRST) {
    showCornerNote(t('house.note.first'), 4000);
  }
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
  var mode = drawModeOf(this.inputStatus.toolName);
  // The strip brush, the brushes' first mode: every cell against the road the mouse goes along, from the road to the plot's
  // back, a few cells either way (owner, 21 Oct 2026: "การวาดสีให้วาด ทีละ 6 แถว กับพื้นถนน"; src/zoneCells.ts cellsInStrip)
  if (mode === 'strip') {
    var strip = cellsInStrip(layout, this.gameMap.width, last, world);
    if (strip.length)
      this.paintCells(strip, data.x);
    return;
  }
  // The round brush: every cell within a few metres of where the mouse went (docs/METRE_DRAWING_PLAN.md 3.2)
  if (mode === 'circle') {
    var round = cellsNear(layout, this.gameMap.width, last, world, BRUSH_RADIUS_M * unitsPerMetre(tileMetres(this.gameMap)));
    if (round.length)
      this.paintCells(round, data.x);
    return;
  }
  var rawKeys = cellsAlong(layout, this.gameMap.width, last, world);
  if (!rawKeys.length)
    return;
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
  // Exactly the cells the mouse went over, one at a time (owner, 18 Oct 2026: "ให้วาดได้ทีละแถวเรียงๆ กันไป ถึงแม้จะลากยากไปขนาดไหน
  // ก็ตาม"), not the whole plot's depth as it once painted: a drag along a road paints a row, the next drag the next row
  this.paintCells(rawKeys, data.x);
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
  if (outcome.accepted) {
    this._edits = (this._edits || 0) + 1;
    // A building put down may be what another needs first (src/unlocks.ts)
    this.scheduleLockRefresh();
  }
  // Land bought near the edge of the frame of its district the city plays opens more of it (docs/DISTRICT_FRAME.md)
  if (outcome.accepted && command.type === 'land')
    this.growFrame();
  // Building outside the province, or a plant the province cannot have, is refused all the time, and says so where
  // the player looks (handleTool)
  if (!outcome.accepted && [OUTSIDE_PROVINCE, NO_RESOURCE, NEEDS_WATER, NEEDS_HOUSE_LEVEL, NEEDS_RAIL, ONE_HSR,
                            TRANSIT_NEEDS_RANK].indexOf(outcome.reason) === -1 && !lockOf(outcome) &&
      HOUSE_REASONS.indexOf(outcome.reason) === -1 && LAND_REASONS.indexOf(outcome.reason) === -1 && command.type !== 'wing')
    console.warn('Command refused: ' + outcome.reason, command);
  return outcome;
};


// The places of a button that groups tools (src/toolLevels.ts), each one the city cannot build yet greyed with its
// reason (src/unlocks.ts); kept as given, so the locks can be asked again as the city changes (refreshLocks)
Game.prototype.setChoices = function(group, list) {
  this._choiceLists = this._choiceLists || {};
  this._choiceLists[group] = list;
  this.showChoices(group, true);
};


// A group's places with their locks, given again to the tools only when one changed: the cards are drawn anew each time
Game.prototype.showChoices = function(group, always) {
  var shown = this._choiceLists[group].map(this.lockChoice, this);
  var key = JSON.stringify(shown);
  this._choiceKeys = this._choiceKeys || {};
  if (!always && this._choiceKeys[group] === key)
    return false;
  this._choiceKeys[group] = key;
  setToolChoices(group, shown);
  this.lockGroupButton(group);
  return true;
};


Game.prototype.clearChoices = function(group) {
  if (this._choiceLists)
    delete this._choiceLists[group];
  clearToolChoices(group);
};


Game.prototype.lockChoice = function(choice) {
  // A power plant's place wears the size its kind takes in the city's era now, 3x3 or 2x2 (src/plantBlocks.ts)
  var tool = this.core.tools && this.core.tools[choice.tool];
  if (tool && tool.powerKind && !choice.action)
    choice = Object.assign({}, choice, {size: tool.size});
  if (!choice.available || choice.action)
    return choice;
  var lock = this.core.commands.lock(choice.tool);
  if (lock)
    return Object.assign({}, choice, {available: false, locked: true, reasonText: lockText(lock)});
  // A big building says how long it stands as a construction site (src/construction.ts)
  var months = siteMonths(choice.tool, modeRule(this.simulation._gameLevel).buildTime);
  return months > 0 && !choice.note ?
    Object.assign({}, choice, {noteText: t('site.choice_months', {price: toolLabel(choice.tool).price, months: months})}) : choice;
};


// A button whose every place is locked stays open to pointing and clicking, which shows each place's reason, greyed
// with a lock and its first place's reason as its title
Game.prototype.lockGroupButton = function(group) {
  var button = document.querySelector('.toolButton[data-tool="' + group + '"]');
  var list = toolChoicesFor(group) || [];
  var first = list.find(function(choice) { return choice.locked; });
  var allLocked = list.length > 0 && !list.some(function(choice) { return choice.available; }) && first !== undefined;
  if (!button)
    return;
  button.classList.toggle('locked', allLocked);
  if (allLocked) {
    button.disabled = false;
    button.dataset.lockTitle = t('unlock.locked_title', {name: plainToolName(first.tool), reason: first.reasonText});
    button.title = button.dataset.lockTitle;
  } else {
    delete button.dataset.lockTitle;
  }
};


// The tools the city cannot build yet asked again: every month, when the era changes, a class graduates or a site is
// done, and a little after the player builds (scheduleLockRefresh)
Game.prototype.refreshLocks = function() {
  if (!this.core)
    return;
  var changed = false;
  for (var group in this._choiceLists || {})
    changed = this.showChoices(group, false) || changed;
  // ... and the buttons of a tool of their own
  var game = this;
  document.querySelectorAll('#buttons .toolButton[data-tool]').forEach(function(button) {
    var tool = button.getAttribute('data-tool');
    if (toolChoicesFor(tool))
      return;
    var lock = game.core.commands.lock(tool);
    var title = lock ? lockedTitle(tool, lock) : undefined;
    if (button.dataset.lockTitle === title)
      return;
    changed = true;
    button.classList.toggle('locked', lock !== null);
    if (title)
      button.dataset.lockTitle = title;
    else
      delete button.dataset.lockTitle;
  });
  if (changed)
    relabelTools();
};


Game.prototype.scheduleLockRefresh = function() {
  if (this._lockTimer)
    return;
  var game = this;
  this._lockTimer = window.setTimeout(function() {
    game._lockTimer = null;
    game.refreshLocks();
  }, 300);
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
  game.setChoices(HOUSE_TOOL, [
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
  game.setChoices('primary_school', EDUCATION_TOOLS.map(serviceChoice));
  game.setChoices('health_centre', HEALTH_TOOLS.map(serviceChoice));
  // Police and fire by level, the higher ones for a higher house, and the upgrade that raises a building a level
  // (src/buildingLevels.ts)
  var levelChoices = function(group, colour) {
    return LEVEL_GROUPS[group].levels.map(function(spec) {
      return {tool: spec.tool, available: spec.house <= level, colour: colour, reason: 'service.reason.house.' + spec.house};
    });
  };
  game.setChoices('police', levelChoices('police', pageChoice('police').colour)
    .concat(levelChoices('fire', pageChoice('fire').colour))
    .concat([{tool: BUILDING_UPGRADE_TOOL, available: true, colour: '#d9a400', note: 'choice.upgrade_note'}]));
  // Public transport, the metro and the high-speed rail station for a higher rank (src/transit.ts)
  game.setChoices('bus_stop', TRANSIT_KINDS.map(function(kind) {
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
  // ... and a tile of the farm zone what the province's rules say (src/farmZone.ts)
  prices[FARM_PAINT_TOOL] = this.farmZoneRules().price;
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
  // Leaving without saving must not be undone by the autosave when the page closes; the start screen once every save
  // is written (src/cityStorage.ts)
  this.autosave.stop();
  var self = this;
  citySavesWritten().then(function(written) {
    if (!written && choice === 'save') {
      self.handleSave();
      return;
    }
    window.location.assign(window.location.pathname);
  });
};


Game.prototype.handleDebugRequest = makeWindowOpenHandler('debug');
Game.prototype.handleDisasterRequest = makeWindowOpenHandler('disaster');
Game.prototype.handleQueryRequest = makeWindowOpenHandler('query');
Game.prototype.handleScreenshotRequest = makeWindowOpenHandler('screenshot');


Game.prototype.handleMandatoryBudget = function() {
  this.simNeededBudget = true;
  this.handleBudgetRequest();
};


var isContinuousTool = function(name) {
  if (!name) return false;
  return name.indexOf('road') === 0 || name === 'motorway' || name === 'tollway' ||
         name === 'rail' || name === 'wire' || name === 'canal' || name === 'bulldozer' || name === 'query' ||
         name.indexOf('zone_') === 0 || name === 'residential' || name === 'commercial' || name === 'industrial';
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

  // A road or railway drawn freely, in metres (freeRoad)
  if (isMetreTool(this.inputStatus.toolName) && drawModeOf(this.inputStatus.toolName) === 'free') {
    this.freeRoad(data);
    return;
  }
  // ... the mouse let go after any other drawn freely lays nothing more
  if (data.release)
    return;

  var tool = this.inputStatus.currentTool;
  var toolName = this.inputStatus.toolName;
  var result;

  // The move tool picks a building up, then puts it down (moveClick)
  if (toolName === MOVE_TOOL) {
    this.moveClick(x, y, tileCoords, data.stroke);
    return;
  }

  // A building on a map painted a cell at a time goes where its outline showed: slid along the road a cell at a time,
  // its tiles the nearest beside the road
  var pose = this.buildingPose(this.inputStatus.toolWidth - 0, x, y);
  // ... its tiles the block round the tile its middle lies on, where its outline showed it (docs/METRE_DRAWING_PLAN.md
  // 2.1), never another place
  tileCoords = pose !== null ? poseTile(pose, this.inputStatus.toolWidth - 0) :
               this.buildingTile(tileCoords, this.inputStatus.toolWidth - 0);

  // A drag that skipped tiles (a quick mouse) fills the gap, so a road or a stroke of paint never breaks
  var last = this._strokeTile;
  this._strokeTile = {stroke: data.stroke, x: tileCoords.x, y: tileCoords.y};
  if (last && last.stroke === data.stroke && toolName !== 'query' && toolName !== 'land' &&
      Math.abs(last.x - tileCoords.x) + Math.abs(last.y - tileCoords.y) > 1) {
    var fill = toolName === UPGRADE_TOOL ? this.upgradeRoadPath([last, tileCoords]) : linePath(last, tileCoords);
    fill.slice(1, -1).forEach(function(tile) {
      var filled = {type: 'tool', tool: toolName, x: tile.x, y: tile.y, stroke: data.stroke};
      if (modeGroupOf(toolName) === 'line' && toolName !== UPGRADE_TOOL)
        filled.shape = 'free';
      this.applyCommand(filled);
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
      this.inputStatus.clearTool();
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
    // A building against its road is put down in metres where its outline stood (src/cityCommands.ts build)
    if (pose !== null) {
      var perUnit = tileMetres(this.gameMap) / 10;
      command = {type: 'build', tool: toolName, x: Math.round(pose[0] * perUnit * 100) / 100,
                 z: Math.round(pose[1] * perUnit * 100) / 100, rot: pose[2], stroke: data.stroke};
    }
    // A road or railway drawn freely follows the mouse, its tiles smoothed (src/roadPieces.ts RoadPath)
    if (modeGroupOf(toolName) === 'line' && toolName !== UPGRADE_TOOL)
      command.shape = 'free';
    var outcome = this.applyCommand(command);
    result = outcome.toolResult;
    // The farm zone needs a cart track to a road within reach (src/farmZone.ts)
    if (toolName === FARM_PAINT_TOOL && outcome.accepted && result === tool.TOOLRESULT_FAILED &&
        fieldOutcome(this.gameMap, tileCoords.x, tileCoords.y, this.farmZoneRules().reach) === 'no_way')
      showCornerNote(t('tool.needs_way', {reach: this.farmZoneRules().reach}), OUTSIDE_NOTE_MS);
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
    // What the city cannot build yet says why: its era, its trained people, what must stand first (src/unlocks.ts)
    var lock = lockOf(outcome);
    if (lock) {
      showCornerNote(lockedTitle(toolName, lock), OUTSIDE_NOTE_MS);
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
  if ((result === tool.TOOLRESULT_OK || (outcome && outcome.accepted)) && (toolName === HOUSE_TOOL || !isContinuousTool(toolName)))
    this.inputStatus.clearTool();
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
  // How big a tile is on the screen, on the camera bar while a line tool is in hand (src/drawReadout.ts)
  var tilePixels = null;
  if (modeGroupOf(this.inputStatus.toolName) !== 'line') {
    showZoom(null);
  } else if (this.inputStatus.mouseX >= 0) {
    tilePixels = pixelsPerTile(this.cityView, this.inputStatus.mouseX, this.inputStatus.mouseY);
    showZoom(tilePixels);
  }
  // The drawing tip shows again below while the mouse is on the map with a tool that draws by modes
  if (this.lineDraft === null)
    this.showDrawTip(null);
  if (this.inputStatus.mouseX === -1 || !(this.inputStatus.toolWidth > 0)) {
    if (this.lineDraft !== null && this._lastDraftHover)
      return this._lastDraftHover;
    return this.selectionOutline();
  }

  var tile = this.cityView.tileAt(this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (tile === null)
    return null;
  if (this.inputStatus.toolName === MOVE_TOOL)
    return this.moveHover(tile);

  // The inputStatus fields came from DOM attributes, so will be strings. Coerce back to numbers.
  var pose = this.buildingPose(this.inputStatus.toolWidth - 0, this.inputStatus.mouseX, this.inputStatus.mouseY);
  tile = pose !== null ? poseTile(pose, this.inputStatus.toolWidth - 0) : this.buildingTile(tile, this.inputStatus.toolWidth - 0);
  if (this.inputStatus.toolName === 'bulldozer')
    tile = this.dozeTile(tile, this.inputStatus.mouseX, this.inputStatus.mouseY);
  var hover = {tile: tile, size: this.inputStatus.toolWidth - 0, colour: this.inputStatus.toolColour || 'yellow'};
  // The bulldozer being dragged shows, red, every tile it will take when the mouse is let go (dozeTiles)
  var pathDrag = this.inputStatus.pathDrag;
  if (pathDrag !== null) {
    hover.path = this.dozeTiles(pathDrag.points);
    hover.line = false;
    hover.doze = true;
    hover.colour = OUTSIDE_COLOUR;
    return hover;
  }
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
    } else if (hover.cellPoint && drawModeOf(this.inputStatus.toolName) === 'strip') {
      // ... and with the strip brush the strip it would paint there, soft under the brush, the only cells shown
      hover.cellKeys = cellsInStrip(this.cellLayout(), cityMap.width, null, [hover.cellPoint.x * 10, hover.cellPoint.y * 10]);
    } else if (hover.cellPoint && drawModeOf(this.inputStatus.toolName) === 'circle') {
      // ... and with the round brush every cell it would paint there
      hover.cellKeys = cellsNear(this.cellLayout(), cityMap.width, null, [hover.cellPoint.x * 10, hover.cellPoint.y * 10],
                                 BRUSH_RADIUS_M * unitsPerMetre(tileMetres(cityMap)));
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
  } else if (this.inputStatus.toolName === 'canal') {
    // A canal's water between its walls (src/render3d/models/terrain/water.ts), whatever the size of the tiles
    hover.roadWidth = 9.4;
  }
  var linePoint = this.linePoint(this.inputStatus.toolName, this.inputStatus.mouseX, this.inputStatus.mouseY);
  // ... and a dot on each road tile near the mouse, where a click may join it (snapDots)
  var dots = this.snapDots(this.inputStatus.toolName, tile);
  if (dots !== null)
    hover.snapDots = dots;
  hover.tilePixels = tilePixels;
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
    // ... red where it could not build (estimateTiles)
    hover.blocked = preview.blocked && preview.blocked.length ? preview.blocked : null;
    hover.drawMode = preview.mode;
    // A road, railway or power line being drawn (including rectangle and grid road modes) uses road ribbons
    hover.line = preview.mode !== 'fill' && (preview.mode !== 'rectangle' || roadLevel > 0 || this.inputStatus.toolName === 'rail' ||
                 this.inputStatus.toolName === 'canal');
    // ... in the colour of what it builds: laterite, asphalt, concrete, railway (owner, 14 Oct 2026)
    if (hover.line && hover.colour !== OUTSIDE_COLOUR) {
      hover.colour = roadLevel === 1 ? '#d9824a' : roadLevel === 2 ? '#4a4f52' : roadLevel > 2 ? '#9a978f' :
                     this.inputStatus.toolName === 'rail' ? '#7a6f63' :
                     this.inputStatus.toolName === 'canal' ? 'steelblue' : DRAW_COLOUR;
    }
    // Every mode's preview is the very line it builds: the straight line or the curve through its points
    hover.straight = isStraightMode(preview.mode);
    hover.controls = preview.controls || null;
  }
  // ... and where the mouse is when the click would land elsewhere, joined to where it lands (src/drawReadout.ts)
  var readout = preview !== null ? preview.readout : null;
  if (readout && (readout.raw.x !== readout.landed.x || readout.raw.y !== readout.landed.y))
    hover.cursorPoint = {x: readout.raw.x + 0.5, y: readout.raw.y + 0.5};
  this.showDrawTip(preview);
  if (preview !== null) {
    if (this.lineDraft !== null)
      this._lastDraftHover = hover;
    return hover;
  }

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


// The erasers' grey, and the farm zone's olive from the theme (src/theme/tokens.ts)
var ERASER_COLOUR = '#8c8c8c';
var FARM_COLOUR = '#' + SCENE.farm.zone.toString(16).padStart(6, '0');

// The first tile value of the zones and buildings (src/tileValues.ts), which a line may not be laid over
var BUILDING_TILES = 240;

// The points of a line drawn by clicks, by name, and how long the note after it stays (src/drawReadout.ts)
var POINT_NAMES = ['A', 'B', 'C', 'D'];
var STROKE_NOTE_MS = 9000;

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
    this.applyTiles(toolName === UPGRADE_TOOL ? this.upgradeLineTiles(tile, data.x, data.y) :
                    this.paintFill(tile, toolName), data.stroke, data.x);
    this.resetDraft();
    return;
  }
  var needed = POINTS_NEEDED[mode];
  if (!needed)
    return;
  if (isMetreTool(toolName)) {
    this.metreToolPoint(data, toolName, mode, needed);
    return;
  }
  var draft = this.lineDraft;
  if (draft === null || draft.tool !== toolName || draft.mode !== mode)
    draft = this.lineDraft = {tool: toolName, mode: mode, points: [], from: null};
  var clicked = tile;
  var snap = this.snapTile(tile, toolName, draft, this.cityView.pointAt ? this.cityView.pointAt(data.x, data.y) : null);
  tile = snap.tile;
  // ... and where on the road it joins it lands, exactly (roadDot)
  draft.exact = (draft.exact || []).concat([snap.exact || null]);
  // Where the line starts, on the middle of the road it leaves from, for its preview
  if (draft.points.length === 0)
    draft.startPoint = this.linePoint(toolName, data.x, data.y);
  // ... and each point where it was clicked and where it was used, for the note after (src/drawReadout.ts)
  draft.clicks = (draft.clicks || []).concat([{name: POINT_NAMES[draft.points.length] || '?', raw: clicked, used: tile}]);
  draft.points.push(tile);
  // The camera glides to the point when it was clicked near the edge or behind the cards, and the tool card steps
  // aside while the line is half drawn (src/drawAssist.ts; owner, 19 Oct 2026)
  var canvas = document.getElementById('MicropolisCanvas');
  focusDrawPoint(this.cityView, tile.x, tile.y, data.x, data.y, canvas);
  if (draft.points.length < needed) {
    setDrawingLine(true);
    return;
  }
  var path = toolName === UPGRADE_TOOL ? this.upgradeRoadPath(draft.points) : this.lineAround(curvePath(draft.points), toolName);
  // ... laid as drawn: one straight line, or the curve through its points (src/roadPieces.ts RoadPath)
  var shape = toolName === UPGRADE_TOOL ? null : {shape: isStraightMode(mode) ? 'straight' : 'curve',
    controls: exactControls(draft.points, draft.exact).map(function(p) { return [p.x, p.y]; })};
  var built = this.applyTiles(path, data.stroke, data.x, shape);
  if (built && modeGroupOf(toolName) === 'line')
    showCornerNote(strokeText(draft.clicks, built.laid, built.total, built.refused), STROKE_NOTE_MS);
  this.resetDraft();
};


// The road, railway and canal tools draw in metres (docs/METRE_DRAWING_PLAN.md 1.5): a road goes where it is clicked,
// to the centimetre, as one road command that lays its tiles (src/cityCommands.ts road) and keeps it as drawn (the road
// graph; railways and canals in graphs of their own, docs/CANALS.md)
var isMetreTool = function(toolName) {
  return toolName === 'rail' || toolName === 'canal' || ROAD_TOOLS.indexOf(toolName) !== -1;
};

// ... and a click of one lands (src/roads/roadDraw.ts): on a junction, a road's end or the road itself within
// SNAP_METRE_PIXELS of it on the screen (only what can be seen, and nothing further), else straight on from the last
// point, along, square to or at 15° steps from the road it left, or north, east, south, west or between, when nearly
// so; just where clicked with Shift held or snapping off. The point in metres (m), the ground under the mouse (raw), why
// it moved (guide: node, end, road, way, angle or null) and the way of the road it joins there
var SNAP_METRE_PIXELS = 14;
Game.prototype.metrePoint = function(toolName, x, y, free) {
  var view = this.cityView;
  var point = typeof view.pointAt === 'function' ? view.pointAt(x, y) : view.tileAt(x, y);
  if (point === null)
    return null;
  var size = tileMetres(this.gameMap), raw = [point.x * size, point.y * size];
  if (free || !snapOn())
    return {m: raw, raw: raw, guide: null, way: null};
  var lines = this.metreLines(toolName);
  var draft = this.lineDraft && this.lineDraft.tool === toolName && this.lineDraft.metres ? this.lineDraft : null;
  var last = draft && draft.metres.length ? draft.metres[draft.metres.length - 1] : null;
  var reach = this.reachTiles(SNAP_METRE_PIXELS, 0.02, 6) * size;
  var snap = snapToRoads(raw, reach, lines.nodes, lines.metres);
  // ... never back onto the point the line is drawn from
  if (snap !== null && (last === null || Math.hypot(snap.point[0] - last[0], snap.point[1] - last[1]) > 1))
    return {m: snap.point, raw: raw, guide: snap.kind, way: snap.way};
  if (last !== null) {
    var leaving = draft.ways[draft.ways.length - 1];
    var straight = snapWay(last, raw, leaving, SNAP_DEGREES);
    if (straight !== null)
      return {m: straight, raw: raw, guide: leaving ? 'way' : 'angle', way: null};
  }
  return {m: raw, raw: raw, guide: null, way: null};
};


// The roads (or railways, or canals) in metres and where they meet, for the tools that draw them (networkLines,
// canalNetwork)
Game.prototype.metreLines = function(toolName) {
  if (toolName === 'canal')
    return this.canalNetwork();
  var rail = toolName === 'rail';
  this.networkLines(rail);
  return this[rail ? '_railLines' : '_roadLines'];
};


// The canals, kept until the city is next changed: those dug in metres exactly as dug (the canal graph,
// src/roads/canalLines.ts), the others smoothed from their tiles, in world units (lines) and metres (metres), with where
// they meet (nodes, metres), as the 3D view draws them (src/render3d/city/canals.ts)
Game.prototype.canalNetwork = function() {
  if (!this._canalLines || this._canalLines.edits !== this._edits) {
    var map = this.gameMap, width = map.width, height = map.height, size = tileMetres(map);
    var value = function(i) { return map.getTileValue(i % width, Math.floor(i / width)); };
    var canal = function(i) { return canalMarkStands(map, i % width, Math.floor(i / width)); };
    var graph = map.canalGraph && map.canalGraph.segments.size ? canalGraphLines(map.canalGraph, {width: width,
      height: height, tileSizeM: size, canal: canal, wet: function(i) { return isWaterTile(value(i)) || isBridgeTile(value(i)); }}) : null;
    var own = new Set(graph ? graph.tiles : []);
    var network = networkOf({width: width, height: height, level: function() { return 1; },
      value: function(i) { return !own.has(i) && canal(i) ? 66 : 0; }}, false);
    var lines = roadLines(network).lines.map(function(line) { return line.points; }).concat(graph ? graph.lines : []);
    var toMetres = size / 10;
    var inMetres = function(p) { return [p[0] * toMetres, p[1] * toMetres]; };
    this._canalLines = {edits: this._edits, lines: lines,
                        metres: lines.map(function(line) { return line.map(inMetres); }),
                        nodes: network.junctions.concat(graph ? graph.junctions : []).map(inMetres)};
  }
  return this._canalLines;
};


// A click of the road or railway tools: a point of the line, which is laid as one road command once it has all its
// points. One drawn too close alongside a road already there is not laid: such roads would share their tiles, and the
// simulation would take them for one road (owner, 20 Oct 2026)
Game.prototype.metreToolPoint = function(data, toolName, mode, needed) {
  var draft = this.lineDraft;
  if (draft === null || draft.tool !== toolName || draft.mode !== mode || !draft.metres)
    draft = this.lineDraft = {tool: toolName, mode: mode, points: [], metres: [], ways: [], from: null};
  var at = this.metrePoint(toolName, data.x, data.y, data.free);
  if (at === null)
    return;
  var size = tileMetres(this.gameMap);
  var tileOf = function(m) { return {x: Math.floor(m[0] / size), y: Math.floor(m[1] / size)}; };
  if (draft.metres.length === 0)
    draft.startPoint = {x: at.m[0] / size, y: at.m[1] / size};
  draft.clicks = (draft.clicks || []).concat([{name: POINT_NAMES[draft.metres.length] || '?', raw: tileOf(at.raw),
                                                used: tileOf(at.m)}]);
  draft.metres.push(at.m);
  draft.ways.push(at.way);
  var tile = tileOf(at.m);
  draft.points.push(tile);
  focusDrawPoint(this.cityView, tile.x, tile.y, data.x, data.y, document.getElementById('MicropolisCanvas'));
  if (draft.metres.length < needed) {
    setDrawingLine(true);
    return;
  }
  var line = lineOfPoints(draft.metres);
  if (alongside(line, this.metreLines(toolName).metres, size).length) {
    // ... the last point taken back, to be clicked again elsewhere
    draft.metres.pop();
    draft.ways.pop();
    draft.points.pop();
    draft.clicks.pop();
    showCornerNote(t('draw.too_close', {metres: Math.round(size)}), OUTSIDE_NOTE_MS);
    this.gameAudio.toolUsed(toolName, this.inputStatus.currentTool.TOOLRESULT_FAILED, data.x);
    return;
  }
  var built = this.applyRoads([{line: line}], data.stroke, data.x);
  if (built)
    showCornerNote(strokeText(draft.clicks, built.laid, built.total, built.refused), STROKE_NOTE_MS);
  // A chain goes on from where this line ended (ต่อเนื่อง, docs/METRE_DRAWING_PLAN.md 1.5): the next click is the next
  // line's end, which snaps along, square to or at 15° steps from this one, until Esc or a right click
  if (mode === 'chain' && built && built.laid > 0) {
    var end = line.to, dx = end[0] - line.from[0], dz = end[1] - line.from[1], len = Math.hypot(dx, dz) || 1;
    this.lineDraft = {tool: toolName, mode: mode, points: [tileOf(end)], metres: [end], ways: [[dx / len, dz / len]], from: null,
                      startPoint: {x: end[0] / size, y: end[1] / size},
                      clicks: [{name: POINT_NAMES[0], raw: tileOf(end), used: tileOf(end)}]};
    setDrawingLine(true);
    return;
  }
  this.resetDraft();
};


// A road or railway drawn freely: a straight road each tile's length the mouse goes, all one drawn line, and the rest
// as far as the mouse is let go; it starts and ends on a road near the mouse as a click does (metrePoint)
Game.prototype.freeRoad = function(data) {
  var toolName = this.inputStatus.toolName, free = this._freeRoad, shift = this.inputStatus.shiftHeld;
  if (!free || free.stroke !== data.stroke) {
    var start = this.metrePoint(toolName, data.x, data.y, shift);
    this._freeRoad = start ? {stroke: data.stroke, last: start.m} : null;
    return;
  }
  var here = this.metrePoint(toolName, data.x, data.y, !data.release || shift);
  if (here === null)
    return;
  var size = tileMetres(this.gameMap);
  if (Math.hypot(here.m[0] - free.last[0], here.m[1] - free.last[1]) < (data.release ? 1 : size))
    return;
  this.applyRoads([{line: lineOfPoints([free.last, here.m])}], data.stroke, data.x);
  free.last = here.m;
};


// Lays roads or railways drawn in metres, a road command each ({line, part}: part a grid's row or column), one stroke so
// they undo together, with one sound for the lot: how many of their tiles are laid, and why the others are not
Game.prototype.applyRoads = function(lines, stroke, soundX) {
  var toolName = this.inputStatus.toolName, tool = this.inputStatus.currentTool;
  if (tool === null || lines.length === 0)
    return null;
  var map = this.gameMap, isLine = this.lineKind(toolName);
  var laid = 0, total = 0, refused = {}, refusal = null;
  lines.forEach(function(item) {
    var line = item.line;
    if (line === null)
      return;
    // The tiles it is laid on, as the command will lay them on the roads drawn before it
    var tiles = this.metreLine(toolName, line).tiles;
    var command = {type: 'road', tool: toolName, from: line.from, to: line.to, stroke: stroke};
    if (line.c1) {
      command.c1 = line.c1;
      command.c2 = line.c2;
    }
    if (item.part !== undefined)
      command.part = item.part;
    var outcome = this.applyCommand(command);
    if (!outcome.accepted && refusal === null)
      refusal = outcome.reason;
    var why = refusal === OUTSIDE_PROVINCE ? t('tool.outside_province') : refusal === LAND_LOCKED ? t('land.note.locked') :
              HOUSE_REASONS.indexOf(refusal) !== -1 ? houseNote(refusal, map) :
              this.simulation.budget.totalFunds < tool.toolCost ? t('draw.debug.no_money') : t('draw.debug.cannot');
    tiles.forEach(function(i) {
      total++;
      if (isLine(i % map.width, Math.floor(i / map.width)))
        laid++;
      else
        refused[why] = (refused[why] || 0) + 1;
    });
  }, this);
  var result = laid > 0 ? tool.TOOLRESULT_OK : this.simulation.budget.totalFunds < tool.toolCost ?
               tool.TOOLRESULT_NO_MONEY : tool.TOOLRESULT_FAILED;
  if (laid === 0 && refusal !== null) {
    var note = refusal === OUTSIDE_PROVINCE ? t('tool.outside_province') : refusal === LAND_LOCKED ? t('land.note.locked') :
               HOUSE_REASONS.indexOf(refusal) !== -1 ? houseNote(refusal, map) : null;
    if (note !== null)
      showCornerNote(note, OUTSIDE_NOTE_MS);
  }
  this.showToolResult(tool, result);
  this.gameAudio.toolUsed(toolName, result, soundX);
  this.refreshUndo();
  return {laid: laid, total: total, refused: Object.keys(refused).map(function(why) { return [why, refused[why]]; })};
};


// A road or railway drawn in metres as the road command lays it on the roads drawn before it: its tiles and its length
// in metres (src/roads/roadDraw.ts lineOnGraph)
Game.prototype.metreLine = function(toolName, line) {
  var map = this.gameMap;
  return lineOnGraph(line, {width: map.width, height: map.height, tileSizeM: tileMetres(map)},
                     toolName === 'rail' ? map.railGraph : toolName === 'canal' ? map.canalGraph : map.roadGraph) ||
         {tiles: [], length: 0};
};


// What a road or railway drawn in metres would cost and where it could not be laid, as the road command prices it
// (src/roads/roadDraw.ts linePrice): each tile tried on its own and put back; seen, the tiles roads laid before it in
// the same stroke take, which it finds a road already; length, its length as laid (metreLine), else as drawn
Game.prototype.estimateRoad = function(line, tiles, seen, length) {
  var tool = this.inputStatus.currentTool, size = tileMetres(this.gameMap), costs = [];
  var estimate = this.estimateTiles(tiles);
  var blockMaps = this.simulation.blockMaps, width = this.gameMap.width;
  tiles.forEach(function(tile) {
    if (!this.gameMap.testBounds(tile.x, tile.y))
      return;
    tool.doTool(tile.x, tile.y, blockMaps);
    costs.push(tool.result === tool.TOOLRESULT_OK && !(seen && seen.has(tile.y * width + tile.x)) ? tool.totalCost() : 0);
    tool.clear();
    if (seen)
      seen.add(tile.y * width + tile.x);
  }, this);
  estimate.cost = linePrice(Math.round(tool.toolCost * (tool.costFactor || 1)), size,
                            length === undefined ? lineLength(line) : length, costs);
  return estimate;
};


// ... and a grid of them: each row and column a straight road of its own, from its first tile's middle to its last's
Game.prototype.gridRoads = function(drag) {
  var from = drag ? this.cityView.tileAt(drag.from.x, drag.from.y) : null;
  if (from === null)
    return [];
  var to = this.cityView.tileAt(drag.to.x, drag.to.y) || from, size = tileMetres(this.gameMap);
  var middle = function(tile) { return [(tile.x + 0.5) * size, (tile.y + 0.5) * size]; };
  return gridLines(from, to).filter(function(tiles) { return tiles.length > 1; }).map(function(tiles, part) {
    return {line: lineOfPoints([middle(tiles[0]), middle(tiles[tiles.length - 1])]), part: part, tiles: tiles};
  });
};


Game.prototype.estimateGrid = function(drag) {
  var out = {cost: 0, blocked: [], why: []}, seen = new Set();
  this.gridRoads(drag).forEach(function(road) {
    var each = this.estimateRoad(road.line, road.tiles, seen);
    out.cost += each.cost;
    out.blocked = out.blocked.concat(each.blocked);
    each.why.forEach(function(why) { if (out.why.indexOf(why) === -1) out.why.push(why); });
  }, this);
  return out;
};


// Shortest path along existing 4-connected road tiles from points[0] to points[last] for UPGRADE_TOOL, so upgrading a
// slanted or curved road hits every tile of its staircase rather than skipping elbows with a Bresenham line
// The upgrade tool's whole-road mode (docs/METRE_DRAWING_PLAN.md, step 1's leftovers): the road under the mouse from
// junction to junction (src/roads/wholeRoad.ts), as {x, y} tiles
Game.prototype.upgradeLineTiles = function(tile, x, y) {
  var map = this.gameMap, size = tileMetres(map), width = map.width;
  var point = typeof this.cityView.pointAt === 'function' ? this.cityView.pointAt(x, y) : null;
  var at = point !== null ? [point.x * size, point.y * size] : [(tile.x + 0.5) * size, (tile.y + 0.5) * size];
  return wholeRoadTiles(map, at[0], at[1], tile.x, tile.y).map(function(i) { return {x: i % width, y: Math.floor(i / width)}; });
};


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


// The middle lines of the roads, or the railways, kept until the city is next changed: those drawn in metres exactly
// as drawn (the road graph), the others smoothed from their tiles (src/roads/graphLines.ts drawnRoads)
Game.prototype.networkLines = function(rail) {
  var cache = rail ? '_railLines' : '_roadLines';
  if (!this[cache] || this[cache].edits !== this._edits) {
    var map = this.gameMap;
    var levels = map.roadLevels, pieces = map.roadPieces, paths = map.roadPaths;
    var value = function(i) { return map.getTileValue(i % map.width, Math.floor(i / map.width)); };
    var piece = function(i) { return pieces ? pieces[i] : 0; };
    var graph = rail ? map.railGraph : map.roadGraph;
    var level = function(i) { return levels ? levels[i] || 1 : 1; };
    var drawnGraph = graph && graph.segments.size ? graphLines(graph, {width: map.width, height: map.height,
      tileSizeM: tileMetres(map), value: value, piece: piece, level: level}, rail) : null;
    // The lines as the 3D view draws them, one where a road runs on through a junction, so a building stands against
    // the road it sees and a click joins the road it sees
    var drawn = drawnRoads({width: map.width, height: map.height, value: value,
      level: function(i) { return levels ? levels[i] || 1 : 1; }, piece: piece,
      path: function(p) { return paths && paths[p] || null; }}, drawnGraph, rail);
    var toMetres = tileMetres(map) / 10;
    this[cache] = {edits: this._edits, lines: drawn.lines.map(function(line) { return line.points; }),
                   levels: drawn.lines.map(function(line) { return line.level; }),
                   // ... and in metres, with where roads meet, for the road and railway tools (metrePoint)
                   metres: drawn.lines.map(function(line) {
                     return line.points.map(function(p) { return [p[0] * toMetres, p[1] * toMetres]; });
                   }),
                   nodes: drawn.points.map(function(p) { return [p[0] * toMetres, p[1] * toMetres]; })};
  }
  return this[cache].lines;
};


// Every building's pose kept with the city (gameMap.buildings, saved), taken from the 3D view for those never turned
// (put down before the buildings were kept in metres): only where the building is drawn, never what the simulation does
Game.prototype.keepBuildingPoses = function() {
  var map = this.gameMap, view = this.cityView;
  if (!map.cellZones || !map.buildings || !view || typeof view.buildingPoseOf !== 'function')
    return 0;
  var units = unitsPerMetre(tileMetres(map)), kept = 0;
  map.buildings.all().forEach(function(b) {
    if (b.rot !== null)
      return;
    var pose = view.buildingPoseOf(b.tile % map.width, Math.floor(b.tile / map.width));
    if (pose) {
      map.buildings.setPose(b.id, pose[0] / units, pose[1] / units, pose[2]);
      kept++;
    }
  });
  return kept;
};


// The move tool (src/moveTool.ts, docs/METRE_DRAWING_PLAN.md 2.5): the first click picks up the ruler's building under
// the mouse, the next puts it down where its outline stands, with the move command, for a tenth of its price
Game.prototype.moveClick = function(x, y, tile, stroke) {
  var map = this.gameMap, game = this;
  if (!this.moving) {
    var picked = buildingAt(map.buildings, map.width, tile.x, tile.y, function(b) { return game.buildingStands(b); });
    if (picked === null) {
      showCornerNote(t('move.note.none'), OUTSIDE_NOTE_MS);
      return;
    }
    this.moving = {id: picked.id, turn: 0};
    return;
  }
  var place = this.movePlace(x, y);
  if (place === null)
    return;
  var outcome = place.problem !== null ? {accepted: false, reason: place.problem} :
    this.applyCommand({type: 'move', id: this.moving.id, x: place.x, z: place.z, rot: place.rot, stroke: stroke});
  if (!outcome.accepted) {
    showCornerNote(this.moveNote(outcome.reason, place.building), OUTSIDE_NOTE_MS);
    return;
  }
  this.moving = null;
  this.writeDrawTip([]);
  this.refreshUndo();
};


// Why the building b may not be moved where the player asked (the move command's reason), in words
Game.prototype.moveNote = function(reason, b) {
  if (reason === MOVE_NO_MONEY)
    return t('move.note.money');
  if (reason === OUTSIDE_PROVINCE)
    return t('tool.outside_province');
  if (reason === LAND_LOCKED)
    return t('land.note.locked');
  if (reason === NEEDS_ROAD_BESIDE)
    return t('tool.needs_road');
  if (reason === NEEDS_ROAD)
    return houseNote(reason, this.gameMap);
  if (reason === NEEDS_WATER)
    return t(b.tool === 'fishing' ? 'tool.needs_water_harbour' : 'tool.needs_water');
  if (reason === NEEDS_RAIL)
    return t('transit.note.needs_rail');
  return t('move.note.blocked');
};


// Whether a building kept in gameMap.buildings still stands on its tiles
Game.prototype.buildingStands = function(b) {
  var map = this.gameMap, x = b.tile % map.width, y = Math.floor(b.tile / map.width);
  return map.testBounds(x, y) && (b.size === 1 || map.getTile(x, y).isZone());
};


// Where the building the move tool carries would go at the pointer (x, y on the view): along its road as a new one would
// (buildingPose), else under the mouse with the turn it had and the turns the player gave it; its middle in metres and
// its turn, the pose to draw its outline, why it may not go there and what it costs (src/cityCommands.ts quoteMove), or null
Game.prototype.movePlace = function(x, y) {
  var map = this.gameMap, b = this.moving && map.buildings ? map.buildings.get(this.moving.id) : null;
  if (!b)
    return null;
  var pose = this.buildingPose(b.size, x, y, 1), free = pose === null;
  if (free) {
    var point = typeof this.cityView.pointAt === 'function' ? this.cityView.pointAt(x, y) : null;
    if (point === null)
      return null;
    pose = [point.x * 10, point.y * 10, (b.rot === null ? 0 : b.rot) + this.moving.turn];
  }
  var perUnit = tileMetres(map) / 10;
  var mx = Math.round(pose[0] * perUnit * 100) / 100, mz = Math.round(pose[1] * perUnit * 100) / 100;
  var rot = Math.round(pose[2] * 1000) / 1000;
  var quote = this.core.commands.quoteMove({type: 'move', id: b.id, x: mx, z: mz, rot: rot});
  return {x: mx, z: mz, rot: rot, pose: pose, problem: quote.reason, cost: quote.cost, building: b, free: free};
};


// The move tool's outline: the building under the mouse to pick up, or the one it carries where it would go, on the
// block it would stand on there, red where it may not go, with a tip of what a click does and costs
Game.prototype.moveHover = function(tile) {
  var map = this.gameMap, game = this, colour = this.inputStatus.toolColour || 'yellow';
  var fill = realUnits(map.tileSizeM) ? BUILDING_SCALE : 1, units = 10 / tileMetres(map);
  var outline = function(b, pose, red) {
    var hover = {tile: pose !== null ? poseTile(pose, b.size) : {x: b.tile % map.width, y: Math.floor(b.tile / map.width)},
                 size: b.size, colour: red ? OUTSIDE_COLOUR : colour, building: true, fill: fill};
    if (pose !== null)
      hover.pose = pose;
    return hover;
  };
  if (!this.moving) {
    var under = buildingAt(map.buildings, map.width, tile.x, tile.y, function(b) { return game.buildingStands(b); });
    this.writeDrawTip([t(under ? 'move.tip.pick' : 'move.tip.find')]);
    if (under === null)
      return {tile: tile, size: 1, colour: colour};
    return outline(under, under.rot === null ? null : [under.x * units, under.z * units, under.rot], false);
  }
  var place = this.movePlace(this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (place === null)
    return null;
  var tip = [place.problem !== null ? this.moveNote(place.problem, place.building) :
             t('move.tip.place', {price: formatMoney(place.cost)})];
  this.writeDrawTip(place.free ? tip.concat([t('move.tip.turn')]) : tip);
  return outline(place.building, place.pose, place.problem !== null);
};


// Where a building of size tiles goes at the pointer (x, y on the view) on a map painted a cell at a time: against the
// nearest road, slid along it a zone cell (2 m) at a time, turned to face it (owner, 14 Oct 2026: "จะขยับซ้ายหรือขวา
// ให้ขยับได้ ทีละช่อง ทุก object"): [x, z, rotation] in world units, or null. stepMetres: how far apart the places along
// the road are, a zone cell (2 m) unless given (the move tool slides a metre at a time)
Game.prototype.buildingPose = function(size, x, y, stepMetres) {
  var map = this.gameMap;
  // Every tool that puts a building down, a one-tile one too (owner, 15 Oct 2026: "tool ทุก tool จะต้อง snap กับ ถนน")
  if (!map.cellZones || !(this.placesBuilding() || this.moving) || typeof this.cityView.pointAt !== 'function')
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
  var step = (stepMetres || 2) * unitsPerMetre(tileMetres(map)), want = Math.round(best.along / step) * step, along = 0;
  for (var i = 1; i < best.line.length; i++) {
    var ax = best.line[i - 1][0], az = best.line[i - 1][1], dx = best.line[i][0] - ax, dz = best.line[i][1] - az;
    var length = Math.hypot(dx, dz) || 1;
    if (along + length >= want || i === best.line.length - 1) {
      var t = Math.max(0, Math.min(1, (want - along) / length)), rx = ax + dx * t, rz = az + dz * t, tx = dx / length, tz = dz / length;
      var nx = -tz, nz = tx;
      if (nx * (px - rx) + nz * (pz - rz) < 0) { nx = -nx; nz = -nz; }
      // (a 3x3 its whole block deep, as it takes the tiles of its outline turned with it, the outline's front at the road's
      // edge: src/buildings/turnedFootprint.ts)
      var turns = size === 3 && isTurned(Math.atan2(-nx, -nz));
      var gap = roadReach(best.level, realUnits(map.tileSizeM)) + 0.6 + size * 5 * (size === 3 ? 1 : BUILDING_SCALE);
      // ... stood back from it a metre at a time while its block would cover a road's tiles or stand beside none (a road
      // at a slant), so the outline is where it goes (poseTile)
      var metre = unitsPerMetre(tileMetres(map)), isRoad = function(tx, ty) {
        return map.testBounds(tx, ty) && isRoadTile(map.getTileValue(tx, ty));
      };
      for (var back = 0; back <= 24 && !turns; back++) {
        var block = blockOf(rx + nx * (gap + back * metre), rz + nz * (gap + back * metre), size, 10), clear = true;
        for (var ty = block.top; ty < block.top + size && clear; ty++)
          for (var tx = block.left; tx < block.left + size && clear; tx++)
            clear = map.testBounds(tx, ty) && !isRoad(tx, ty);
        if (clear && besideRoad(map.width, map.height, isRoad, block.cx, block.cy, size)) {
          gap += back * metre;
          break;
        }
      }
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
  // ... in metres for the road and railway tools: where a click lands, exactly (metrePoint)
  if (isMetreTool(toolName)) {
    var at = this.metrePoint(toolName, x, y, this.inputStatus.shiftHeld), size = tileMetres(this.gameMap);
    return at === null ? null : {x: at.m[0] / size, y: at.m[1] / size};
  }
  var point = this.cityView.pointAt(x, y), tile = this.cityView.tileAt(x, y);
  if (point === null || tile === null || !snapOn())
    return point;
  // Where the click would really land (snapTile): on the middle line of the road it joins, at that road tile, or on
  // the tile a guideline moves it to, so the marker never shows a join the road would not make
  var snap = this.snapTile(tile, toolName, this.lineDraft && this.lineDraft.tool === toolName ? this.lineDraft : null, point);
  var middle = {x: snap.tile.x + 0.5, y: snap.tile.y + 0.5};
  if (snap.guide === 'road') {
    if (snap.exact)
      return snap.exact;
    var near = nearestOnLines(this.networkLines(toolName === 'rail'), middle.x * 10, middle.y * 10, 10);
    return near ? {x: near[0] / 10, y: near[1] / 10} : middle;
  }
  return snap.tile.x !== tile.x || snap.tile.y !== tile.y ? middle : point;
};


// While a road or railway tool is in hand, the points where a click may join a line of its kind within this many tiles
// of the mouse: a tile apart along each line's middle, as evenly on a slanted road as a straight one (owner, 18 Oct 2026:
// "ตามถนน ควรจะมีระยะห่าง แต่ละจุดที่ plot ลงไปได้ แบบชัดเจน ในระแวกที่เม้าชี้ไป", then "ทำไมมันเว้นจุดนึงน่ะ" of the
// uneven points a staircase of tiles gave), and its dead ends marked bigger; worked out again only when the mouse's tile
// or the city changes
var DOT_STEP = 10;
Game.prototype.snapDots = function(toolName, tile) {
  if (modeGroupOf(toolName) !== 'line' || toolName === 'wire')
    return null;
  // As far as a click grabs (roadReach; metrePoint for the roads and railways), so each dot in sight is one a click near
  // it lands on
  var tiles = isMetreTool(toolName) ? this.reachTiles(SNAP_METRE_PIXELS, 0.02, 6) : this.roadReach();
  // ... counted from the mouse for those, which land where clicked
  var here = isMetreTool(toolName) && typeof this.cityView.pointAt === 'function' ?
             this.cityView.pointAt(this.inputStatus.mouseX, this.inputStatus.mouseY) : null;
  var key = [toolName, tile.x, tile.y, this._edits, Math.round(tiles * 4),
             here ? Math.round(here.x * 20) + ',' + Math.round(here.y * 20) : ''].join('|');
  if (this._snapDots && this._snapDots.key === key)
    return this._snapDots.dots;
  // (half a tile more, as a click's reach is counted from tile middles, src/drawPaths.ts snapPoint)
  var isLine = this.lineKind(toolName), reach = (tiles + (here ? 0 : 0.5)) * 10;
  var mx = here ? here.x * 10 : (tile.x + 0.5) * 10, mz = here ? here.y * 10 : (tile.y + 0.5) * 10;
  var ends = [], dots = [];
  (toolName === 'canal' ? this.canalNetwork().lines : this.networkLines(toolName === 'rail')).forEach(function(line) {
    if (line.length < 2 || !line.some(function(p) { return Math.abs(p[0] - mx) < reach + 20 && Math.abs(p[1] - mz) < reach + 20; }))
      return;
    // Its dead ends
    [line[0], line[line.length - 1]].forEach(function(p) {
      var x = Math.floor(p[0] / 10), y = Math.floor(p[1] / 10);
      var beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(function(d) { return isLine(x + d[0], y + d[1]); }).length;
      if (beside <= 1 && Math.hypot(p[0] - mx, p[1] - mz) <= reach)
        ends.push({x: p[0] / 10, y: p[1] / 10, end: true});
    });
    // ... and a point every DOT_STEP along it from its start (roadDot)
    dotsAlong(line, function(x, z) {
      if (Math.hypot(x - mx, z - mz) <= reach)
        dots.push({x: x / 10, y: z / 10, end: false});
    });
  });
  // A point at a dead end is its ring
  dots = dots.filter(function(dot) {
    return !ends.some(function(end) { return Math.hypot(end.x - dot.x, end.y - dot.y) < 0.5; });
  }).concat(ends);
  this._snapDots = {key: key, dots: dots};
  return dots;
};


// Calls at(x, z) with each point a dot lies at along a line (world units): every DOT_STEP from its start
var dotsAlong = function(line, at) {
  var along = 0;
  for (var i = 1; i < line.length; i++) {
    var ax = line[i - 1][0], az = line[i - 1][1], dx = line[i][0] - ax, dz = line[i][1] - az, length = Math.hypot(dx, dz);
    for (var s = Math.ceil(along / DOT_STEP) * DOT_STEP; s < along + length || (i === line.length - 1 && s <= along + length); s += DOT_STEP) {
      var t = length ? (s - along) / length : 0;
      at(ax + dx * t, az + dz * t);
    }
    along += length;
  }
};


// Where a click joins a road (or railway) at a tile it snapped onto (snapTile), as the dots show (snapDots): a dead end's
// very end, else the dot on the line through that tile nearest the mouse (point, in tiles); in tiles, or null
Game.prototype.roadDot = function(toolName, tile, point) {
  var lines = this.networkLines(toolName === 'rail');
  var tx = (tile.x + 0.5) * 10, tz = (tile.y + 0.5) * 10;
  var px = point ? point.x * 10 : tx, pz = point ? point.y * 10 : tz;
  if (this.lineEndWay(toolName, tile) !== null) {
    var end = null;
    lines.forEach(function(line) {
      [line[0], line[line.length - 1]].forEach(function(p) {
        if (Math.hypot(p[0] - tx, p[1] - tz) <= 0.5)
          end = {x: p[0] / 10, y: p[1] / 10};
      });
    });
    if (end !== null)
      return end;
  }
  // The dot nearest the mouse on a line passing the tile
  var best = null;
  lines.forEach(function(line) {
    if (!nearestOnLines([line], tx, tz, 8))
      return;
    dotsAlong(line, function(x, z) {
      var d = Math.hypot(x - px, z - pz);
      if (Math.hypot(x - tx, z - tz) <= 15 && (best === null || d < best.d))
        best = {x: x / 10, y: z / 10, d: d};
    });
  });
  return best === null ? null : {x: best.x, y: best.y};
};


// A line's points for its drawn shape (src/roadPieces.ts controls), in tiles as their corners count: each clicked tile,
// or the exact point where it joined a road (roadDot), half a tile back so its middle is that point
var exactControls = function(points, exact) {
  return points.map(function(p, i) {
    var at = exact && exact[i];
    return at ? {x: Math.round((at.x - 0.5) * 100) / 100, y: Math.round((at.y - 0.5) * 100) / 100} : {x: p.x, y: p.y};
  });
};


// How far, in tiles, a click snaps (src/drawPaths.ts): about this many pixels on the screen round the mouse, so a
// road's end is as easy to hit zoomed out as zoomed in (owner, 18 Oct 2026: "เกี่ยวกับการ zoom out/in ด้วยหรือป่าวนะ")
var SNAP_PIXELS = 18;
// ... and a click grabs a road, railway or power line (a dot on it) within this many pixels, the same as dots show:
// whatever dot is in sight, a click near it lands on it (owner, 18 Oct 2026: "ปุ่ม snap กับจุด ไม่ยอมจับหลายถนน" → "คลิกใกล้
// จุดต้องดูดเสมอ"), in tiles at least ROAD_REACH_MIN and at most ROAD_REACH_MAX. Only as far as a click that means a
// road: a road clicked beside one 2 tiles off was moved onto it (owner, 20 Oct 2026: "บอกแล้วไง ห้ามขยับ")
var ROAD_PIXELS = 44, ROAD_REACH_MIN = 0.75, ROAD_REACH_MAX = 6;
Game.prototype.reachTiles = function(pixels, min, max) {
  var view = this.cityView, x = this.inputStatus.mouseX, y = this.inputStatus.mouseY;
  var at = function(px, py) { return typeof view.pointAt === 'function' ? view.pointAt(px, py) : view.tileAt(px, py); };
  var here = x >= 0 ? at(x, y) : null, across = here ? at(x + pixels, y) : null, down = here ? at(x, y + pixels) : null;
  if (!here || !across || !down)
    return min;
  var tiles = Math.max(Math.hypot(across.x - here.x, across.y - here.y), Math.hypot(down.x - here.x, down.y - here.y));
  return Math.max(min, Math.min(max, tiles));
};


Game.prototype.snapReach = function() {
  return this.reachTiles(SNAP_PIXELS, MIN_SNAP_REACH, MAX_SNAP_REACH);
};


Game.prototype.roadReach = function() {
  return this.reachTiles(ROAD_PIXELS, ROAD_REACH_MIN, ROAD_REACH_MAX);
};


// Whether a tile is of a line tool's kind: a railway, a power line, water or a bridge over it for a canal
// (src/canals.ts), or a road
// A line's tiles taken round a building's corner tile where the staircase can step the other way (src/drawPaths.ts
// aroundCorners): a building's tiles lie square while its lot turns with its road, so a corner may stick out beside a road
// drawn along the lot (owner, 20 Oct 2026)
Game.prototype.lineAround = function(path, toolName) {
  if (modeGroupOf(toolName) !== 'line' || toolName === UPGRADE_TOOL)
    return path;
  var map = this.gameMap, ours = this.lineKind(toolName);
  return aroundCorners(path, function(x, y) {
    return map.testBounds(x, y) && !ours(x, y) && map.getTileValue(x, y) >= BUILDING_TILES;
  });
};


Game.prototype.lineKind = function(toolName) {
  var map = this.gameMap;
  var kind = toolName === 'rail' ? function(v) { return v >= RAILBASE && v <= LASTRAIL; } :
             toolName === 'wire' ? function(v) { return v >= POWERBASE && v <= LASTPOWER; } :
             toolName === 'canal' ? function(v) { return isWaterTile(v) || isBridgeTile(v); } : isRoadTile;
  return function(x, y) { return map.testBounds(x, y) && kind(map.getTileValue(x, y)); };
};


// Where a click of a line tool lands with snapping on (src/drawPaths.ts): onto a road, railway or power line of its
// kind within reach (snapReach), else along a straight or 45° line from the last point, else (a line's first point)
// onto the guideline a block of plots from a straight road beside it; never moved further than reach. guide says which.
// Onto a road or railway it lands on a dot (roadDot) nearest the mouse (point, in tiles), exact, at that dot's tile
Game.prototype.snapTile = function(tile, toolName, draft, point) {
  if (!snapOn())
    return {tile: tile, guide: null};
  var reach = this.snapReach();
  var isLine = this.lineKind(toolName);
  var roadReach = this.roadReach();
  var snapped = snapPoint(tile, isLine, GRID_SPACING, roadReach, Math.max(END_SNAP_REACH, roadReach));
  var points = draft ? draft.points : [];
  if (snapped.guide === 'road') {
    var exact = toolName === 'wire' || toolName === 'canal' ? null : this.roadDot(toolName, snapped.point, point || null);
    var at = exact ? {x: Math.floor(exact.x), y: Math.floor(exact.y)} : null;
    var landing = at && isLine(at.x, at.y) ? at : snapped.point, last = points.length ? points[points.length - 1] : null;
    // ... but never back onto the point the line is drawn from: a line going on from a road's end landed on that end
    // again, a line no tiles long that could not be built (owner, 20 Oct 2026: "ทำวาดถนนตรงนี้ไม่ได้?")
    if (!last || Math.hypot(landing.x - last.x, landing.y - last.y) > 1.5)
      return {tile: landing, guide: 'road', exact: exact};
  }
  // A line started at a road's dead end goes on along its way (src/roadGeometry.ts smooth joints)
  var way = points.length === 1 ? this.lineEndWay(toolName, points[0]) : null;
  var along = way ? snapAlong(points[0], tile, way, SNAP_DEGREES, reach) : null;
  if (along !== null)
    return {tile: along, guide: 'way'};
  if (points.length > 0) {
    var angled = snapAngle(points[points.length - 1], tile, SNAP_DEGREES, reach);
    return {tile: angled, guide: null};
  }
  return {tile: snapped.point, guide: snapped.guide};
};


// The way a road or railway goes on from its dead end at a tile, as it is drawn (its last stretch, src/roadGeometry.ts):
// a unit vector in tiles, or null where no line of the tool's kind ends there alone
Game.prototype.lineEndWay = function(toolName, tile) {
  if (modeGroupOf(toolName) !== 'line' || toolName === 'wire' || toolName === 'canal')
    return null;
  var x = (tile.x + 0.5) * 10, z = (tile.y + 0.5) * 10, found = null, count = 0;
  this.networkLines(toolName === 'rail').forEach(function(line) {
    if (line.length < 2)
      return;
    [[0, 1], [line.length - 1, -1]].forEach(function(end) {
      var p = line[end[0]];
      if (Math.hypot(p[0] - x, p[1] - z) > 0.5)
        return;
      count++;
      // From about a tile and a half back along it, out through its end
      var along = 0, k = end[0];
      while (along < 15 && k + end[1] >= 0 && k + end[1] < line.length) {
        along += Math.hypot(line[k + end[1]][0] - line[k][0], line[k + end[1]][1] - line[k][1]);
        k += end[1];
      }
      var dx = p[0] - line[k][0], dz = p[1] - line[k][1], length = Math.hypot(dx, dz);
      if (length > 0)
        found = {x: dx / length, y: dz / length};
    });
  });
  return count === 1 ? found : null;
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
  this.moving = null;
  setDrawingLine(false);
  this._lastDraftHover = null;
  this._cellStroke = null;
  this._strokeTile = null;
  this.showDrawTip(null);
};


// A right click puts the tool in hand down at once, with any line half drawn (owner, 14 Oct 2026: "คลิกขวา แล้ว ให้
// tool นั้นหาย ไปเลยได้ไหม"); a right drag still turns the camera, and Esc still takes a half-drawn line first
Game.prototype.cancelDraft = function() {
  this.resetDraft();
  this.inputStatus.clearTool();
  // ... and the tool card left open goes too (owner, 18 Oct 2026: "ถ้าคลิกขวา ให้ยกเลิก tool และ ซ่อน card ที่เปิดค้างไว้")
  closeToolTray();
};


// Builds along a drawn line or over a painted area: a command a tile, all one stroke so they undo together, with one
// sound and one note for the lot
Game.prototype.applyTiles = function(tiles, stroke, soundX, extra) {
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tool === null || tiles.length === 0)
    return;

  var best = null;
  var refusal = null;
  var broke = false;
  // A line tool: how many of its tiles end up of its kind, and why the others do not (src/drawReadout.ts)
  var isLine = modeGroupOf(toolName) === 'line' && toolName !== UPGRADE_TOOL ? this.lineKind(toolName) : null;
  var laid = 0, total = 0, refused = {};
  tiles.forEach(function(tile, index) {
    if (!this.gameMap.testBounds(tile.x, tile.y))
      return;
    // extra: what each command also says (a line's shape, a grid line's part), the same for all or by tile
    var command = {type: 'tool', tool: toolName, x: tile.x, y: tile.y, stroke: stroke};
    if (extra)
      Object.assign(command, typeof extra === 'function' ? extra(tile, index) : extra);
    var outcome = this.applyCommand(command);
    if (!outcome.accepted && refusal === null)
      refusal = outcome.reason;
    var result = outcome.toolResult;
    if (result === tool.TOOLRESULT_NO_MONEY)
      broke = true;
    if (result !== null && result !== undefined && (best === null || result === tool.TOOLRESULT_OK))
      best = result;
    if (isLine === null)
      return;
    total++;
    if (isLine(tile.x, tile.y)) {
      laid++;
      return;
    }
    var why = !outcome.accepted ? (outcome.reason === OUTSIDE_PROVINCE ? t('tool.outside_province') :
                                   outcome.reason === LAND_LOCKED ? t('land.note.locked') :
                                   HOUSE_REASONS.indexOf(outcome.reason) !== -1 ? houseNote(outcome.reason, this.gameMap) :
                                   t('draw.debug.cannot')) :
              result === tool.TOOLRESULT_NO_MONEY ? t('draw.debug.no_money') :
              result === tool.TOOLRESULT_NEEDS_BULLDOZE ? t('draw.debug.needs_bulldoze') : t('draw.debug.cannot');
    refused[why] = (refused[why] || 0) + 1;
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
  return isLine === null ? null :
    {laid: laid, total: total, refused: Object.keys(refused).map(function(why) { return [why, refused[why]]; })};
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
  var metre = isMetreTool(toolName);
  var key = [toolName, mode, tile.x, tile.y, this._edits, draft ? JSON.stringify(draft.metres || draft.points) : '',
             drag ? [drag.from.x, drag.from.y, drag.to.x, drag.to.y].join(',') : '', snapOn(),
             metre ? [this.inputStatus.mouseX, this.inputStatus.mouseY, this.inputStatus.shiftHeld].join(',') : ''].join('|');
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
    tiles = toolName === UPGRADE_TOOL ? this.upgradeLineTiles(tile, this.inputStatus.mouseX, this.inputStatus.mouseY) :
            this.paintFill(tile, toolName);
  }
  var guide = null;
  var angle = null, endAngle = null, heading = null;
  var controls = null;
  var readout = null;
  // A road or railway drawn in metres: the very line the road command lays, its tiles as the command works them out
  // (src/roads/roadDraw.ts), its length and its price by the metre, and red where it runs too close alongside a road
  var line = null, lineMetres = 0, close = [];
  if (POINTS_NEEDED[mode] && metre && this.inputStatus.mouseX >= 0) {
    var at = this.metrePoint(toolName, this.inputStatus.mouseX, this.inputStatus.mouseY, this.inputStatus.shiftHeld);
    var size = tileMetres(this.gameMap), mapSize = {width: this.gameMap.width, height: this.gameMap.height, tileSizeM: size};
    var tileOf = function(m) { return {x: Math.floor(m[0] / size), y: Math.floor(m[1] / size)}; };
    var drawn = draft !== null && draft.metres ? draft.metres : [];
    if (at !== null) {
      guide = at.guide === 'node' || at.guide === 'end' ? 'road' : at.guide === 'way' ? 'way' : null;
      readout = {name: POINT_NAMES[drawn.length] || '?', raw: tileOf(at.raw), landed: tileOf(at.m),
                 why: at.guide === 'end' ? 'end' : at.guide === 'node' || at.guide === 'road' ? 'road' :
                      at.guide === 'way' ? 'way' : at.guide === 'angle' ? 'angle' : 'none',
                 start: drawn.length > 0 ? tileOf(drawn[0]) : null};
      if (drawn.length > 0) {
        line = lineOfPoints(drawn.concat([at.m]));
        var placed = this.metreLine(toolName, line);
        tiles = placed.tiles.map(function(i) { return {x: i % mapSize.width, y: Math.floor(i / mapSize.width)}; });
        // ... drawn by the view as the curve through its control points, half a tile back as a tile's middle is its point
        controls = [line.from].concat(line.c1 ? [line.c1, line.c2] : [], [line.to]).map(function(m) {
          return {x: m[0] / size - 0.5, y: m[1] / size - 0.5};
        });
        lineMetres = placed.length;
        close = alongside(line, this.metreLines(toolName).metres, size);
        // The angle it leaves the road it starts on at, else the way it heads (docs/METRE_DRAWING_PLAN.md, step 1's
        // leftovers: an angle in every mode) ...
        var way = draft.ways[0], dx = (line.c1 || line.to)[0] - line.from[0], dz = (line.c1 || line.to)[1] - line.from[1];
        if (way && Math.hypot(dx, dz) > 0)
          angle = meetAngle(way, dx, dz);
        else if (Math.hypot(dx, dz) > 0)
          heading = headingOf(dx, dz);
        // ... and the angle it meets the road its end lands on at
        var ex = line.to[0] - (line.c2 || line.from)[0], ez = line.to[1] - (line.c2 || line.from)[1];
        if (at.way && Math.hypot(ex, ez) > 0)
          endAngle = meetAngle(at.way, ex, ez);
      }
    }
  } else if (mode === 'free' && metre && this._freeRoad && this.inputStatus.mouseX >= 0) {
    // A road drawn freely: the way its last piece heads
    var here = this.metrePoint(toolName, this.inputStatus.mouseX, this.inputStatus.mouseY, true), last = this._freeRoad.last;
    if (here !== null && Math.hypot(here.m[0] - last[0], here.m[1] - last[1]) > 0)
      heading = headingOf(here.m[0] - last[0], here.m[1] - last[1]);
  } else if (POINTS_NEEDED[mode]) {
    var snap = this.snapTile(tile, toolName, draft);
    guide = snap.guide;
    // The numbers beside the mouse (src/drawReadout.ts): where the next point is, where it lands and why
    if (modeGroupOf(toolName) === 'line')
      readout = {name: POINT_NAMES[draft !== null ? draft.points.length : 0] || '?', raw: tile, landed: snap.tile,
                 why: snapWhy(tile, snap.tile, snap.guide, this.lineKind(toolName)),
                 start: draft !== null && draft.points.length > 0 ? draft.points[0] : null};
    if (draft !== null && draft.points.length > 0) {
      var points = draft.points.concat([snap.tile]);
      tiles = toolName === UPGRADE_TOOL ? this.upgradeRoadPath(points) : this.lineAround(curvePath(points), toolName);
      controls = toolName === UPGRADE_TOOL ? null : exactControls(points, draft.exact);
      var start = points[0], leaving = points[1];
      angle = joinAngle({x: leaving.x - start.x, y: leaving.y - start.y}, draft.from, this.roadWayAt(start));
    } else if (snap.tile.x !== tile.x || snap.tile.y !== tile.y) {
      // Where the first click would land
      tiles = [snap.tile];
    }
  }
  var step = POINTS_NEEDED[mode] ? (draft !== null ? draft.points.length : 0) : -1;
  // A drawn line's length on the ground, as the 3D view smooths its steps: along every fourth tile
  var metres = lineMetres;
  if (POINTS_NEEDED[mode] && tiles.length > 1 && line === null) {
    for (var i = 4; i < tiles.length + 3; i += 4) {
      var a = tiles[i - 4], b = tiles[Math.min(i, tiles.length - 1)];
      metres += Math.hypot(b.x - a.x, b.y - a.y);
    }
    metres *= this.gameMap.tileSizeM || DRAWN_TILE_M;
  }
  var estimate = line !== null ? this.estimateRoad(line, tiles, null, lineMetres) : metre && mode === 'grid' && tiles.length > 0 ?
                 this.estimateGrid(drag) : tiles.length > 0 ? this.estimateTiles(tiles) : {cost: 0, blocked: [], why: []};
  if (close.length) {
    var tileSize = tileMetres(this.gameMap);
    close.forEach(function(m) { estimate.blocked.push({x: Math.floor(m[0] / tileSize), y: Math.floor(m[1] / tileSize)}); });
    estimate.why.push('close');
  }
  this._preview = {key: key, tiles: tiles, cost: estimate.cost, blocked: estimate.blocked, blockedWhy: estimate.why, mode: mode,
                   step: step,
                   metres: metres, angle: angle, endAngle: endAngle, heading: heading, guide: guide, controls: controls,
                   readout: readout};
  return this._preview;
};


// What the tool in hand would cost over these tiles, each tried on its own and put back (an estimate: tiles that
// would join up may cost a little less)
Game.prototype.estimateCost = function(tiles) {
  return this.estimateTiles(tiles).cost;
};


// ... and, for a line tool, the tiles it could not build on: outside the province, land not bought, or what the tool
// itself refuses, other than its own kind already there (owner, 18 Oct 2026: a road must never come out broken unseen)
Game.prototype.estimateTiles = function(tiles) {
  var map = this.gameMap, inside = canBuildIn(map);
  var isLine = modeGroupOf(this.inputStatus.toolName) === 'line' && this.inputStatus.toolName !== UPGRADE_TOOL ?
               this.lineKind(this.inputStatus.toolName) : null;
  var blocked = [], why = [];
  var cost = this.estimateCostOf(tiles, function(tile, ok) {
    if (isLine === null || isLine(tile.x, tile.y))
      return;
    // ... and why, to say beside the mouse: outside the province, land not bought, a building's lot (a building on a
    // city map is drawn smaller than its tiles, so the edge of its lot looks open: owner, 18 Oct 2026), or else
    var reason = !inside(tile.x, tile.y) ? 'outside' : !ownsLand(map, tile.x, tile.y) ? 'land' :
                 ok ? null : map.getTileValue(tile.x, tile.y) >= BUILDING_TILES ? 'building' : 'other';
    if (reason === null)
      return;
    blocked.push(tile);
    if (why.indexOf(reason) === -1)
      why.push(reason);
  });
  return {cost: cost, blocked: blocked, why: why};
};


Game.prototype.estimateCostOf = function(tiles, each) {
  var tool = this.inputStatus.currentTool;
  var blockMaps = this.simulation.blockMaps;
  var total = 0;
  tiles.forEach(function(tile) {
    if (!this.gameMap.testBounds(tile.x, tile.y))
      return;
    tool.doTool(tile.x, tile.y, blockMaps);
    if (tool.result === tool.TOOLRESULT_OK)
      total += tool.totalCost();
    if (each)
      each(tile, tool.result === tool.TOOLRESULT_OK);
    tool.clear();
  }, this);
  return total;
};


// Beside the mouse while drawing: what to click next, and how many tiles and how much the drawing would take
Game.prototype.showDrawTip = function(preview) {
  var tip = document.getElementById('drawTip');
  if (!tip)
    return;
  if (preview === null) {
    if (this.lineDraft !== null)
      return;
    tip.hidden = true;
    tip.dataset.text = '';
    return;
  }
  // Concise metric chips: where the points are (src/drawReadout.ts), angle, guide, length, cost (wordy step/cancel text
  // omitted per user request)
  var parts = [], map = this.gameMap, readout = preview.readout;
  if (readout) {
    if (readout.start)
      parts.push(pointText('A', readout.start, tileHeight(map, readout.start)));
    parts.push(nextText(readout.name, readout.raw, tileHeight(map, readout.raw), readout.landed, tileHeight(map, readout.landed),
                        readout.why));
  }
  if (preview.angle !== null && preview.angle !== undefined && preview.tiles.length > 1)
    parts.push('∠ ' + preview.angle + '°');
  if (preview.heading !== null && preview.heading !== undefined)
    parts.push(t('draw.heading', {degrees: preview.heading}));
  if (preview.endAngle !== null && preview.endAngle !== undefined)
    parts.push(t('draw.angle_end', {degrees: preview.endAngle}));
  if (preview.guide)
    parts.push(t('draw.snap.' + preview.guide));
  if (preview.metres > 0)
    parts.push('↔ ' + (preview.metres >= 1000 ? t('draw.length_km', {km: (preview.metres / 1000).toFixed(1)}) :
                       t('draw.length', {metres: Math.round(preview.metres)})));
  if (preview.tiles.length > 0)
    parts.push(t('draw.cost', {count: preview.tiles.length, price: formatMoney(preview.cost)}));
  if (preview.blocked && preview.blocked.length > 0)
    parts.push(t('draw.debug.blocked', {count: preview.blocked.length,
      why: (preview.blockedWhy || []).map(function(reason) { return t('draw.debug.blocked.' + reason); }).join(', ')}));
  this.writeDrawTip(parts);
};


// The drawing tip's chips, one a part, beside the mouse
Game.prototype.writeDrawTip = function(parts) {
  var tip = document.getElementById('drawTip');
  if (!tip)
    return;
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
  if (this.inputStatus.mouseX >= 0 && this.inputStatus.mouseY >= 0) {
    tip.style.left = Math.round(rect.left + this.inputStatus.mouseX + 18) + 'px';
    tip.style.top = Math.round(rect.top + this.inputStatus.mouseY + 20) + 'px';
  }
};


// A zone tool's dragged area, released: a zone at each centre, all one stroke so they undo together
// The tiles the bulldozer takes for the way the mouse went (canvas pixels, src/dozing.ts), worked out again only when
// the mouse has gone further
Game.prototype.dozeTiles = function(points) {
  var last = points[points.length - 1], key = points.length + ',' + last.x + ',' + last.y + ',' + this._edits;
  if (this._dozeCache && this._dozeCache.key === key)
    return this._dozeCache.tiles;
  var view = this.cityView;
  var at = [];
  points.forEach(function(p) {
    var point = typeof view.pointAt === 'function' ? view.pointAt(p.x, p.y) : null;
    if (point !== null)
      at.push(point);
  });
  var tiles = dozeStroke(this.gameMap, at, isOpenLand);
  this._dozeCache = {key: key, tiles: tiles};
  return tiles;
};


// The bulldozer's mouse let go: it takes every tile it went over, one stroke so it undoes together, a road tile left alone
// beside them too, with one sound and one note for the lot (owner, 18 Oct 2026: "ให้คลิก drag จนกว่า จะปล่อยเม้าส์ ถึงลบ")
Game.prototype.handleToolPath = function(data) {
  var toolName = this.inputStatus.toolName, tool = this.inputStatus.currentTool;
  if (tool === null || toolName !== 'bulldozer')
    return;
  var tiles = this.dozeTiles(data.points);
  this._dozeCache = null;
  if (tiles.length === 0)
    return;
  var best = null, refusal = null;
  var lay = function(tile) {
    var outcome = this.applyCommand({type: 'tool', tool: toolName, x: tile.x, y: tile.y, stroke: data.stroke});
    if (best === null || outcome.toolResult === tool.TOOLRESULT_OK)
      best = outcome.toolResult;
    if (refusal === null && !outcome.accepted)
      refusal = outcome.reason;
  }.bind(this);
  tiles.forEach(lay);
  loneRoads(this.gameMap, tiles).forEach(lay);
  // Refused outside the province, on land not bought, or before the ruler's house stands: one note, whatever the tiles
  if (refusal === OUTSIDE_PROVINCE)
    showCornerNote(t('tool.outside_province'), OUTSIDE_NOTE_MS);
  else if (refusal === LAND_LOCKED)
    showCornerNote(t('land.note.locked'), OUTSIDE_NOTE_MS);
  else if (HOUSE_REASONS.indexOf(refusal) !== -1)
    showCornerNote(houseNote(refusal, this.gameMap), OUTSIDE_NOTE_MS);
  var last = data.points[data.points.length - 1];
  this.showToolResult(tool, best);
  this.gameAudio.toolUsed(toolName, best, last.x);
  this.refreshUndo();
  this.refreshHouse();
};


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
    if (mode === 'grid' && isMetreTool(toolName)) {
      // A grid of roads or railways in metres: each row and column a road command of its own
      this.applyRoads(this.gridRoads(data), data.stroke, data.to.x);
    } else if (mode === 'grid') {
      // A grid's rows and columns are straight roads of their own, built as drawn (src/drawPaths.ts gridLines)
      var lines = gridLines(from, to), tiles = [], parts = [];
      lines.forEach(function(line, part) { line.forEach(function(tile) { tiles.push(tile); parts.push(part); }); });
      this.applyTiles(tiles, data.stroke, data.to.x, function(tile, index) { return {part: parts[index], shape: 'straight'}; });
    } else {
      this.applyTiles(rectanglePath(from, to), data.stroke, data.to.x);
    }
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


// With a tool in hand (owner, 19 Oct 2026; until then only with a line half drawn), the mouse near an edge of the screen
// slides the camera towards it, so the next point can be reached when it lies beyond the screen or under a card
// (src/edgeScroll.ts; owner, 18 Oct 2026). Drags of a rectangle or of the
// bulldozer keep their pixels, which a moving camera would spoil, so they do not slide.
Game.prototype.edgeScrollView = function() {
  var now = performance.now(), last = this._edgeTime || now;
  this._edgeTime = now;
  var input = this.inputStatus, pan = panOf(this.cityView);
  if (pan === null || input.currentTool === null || input.mouseX < 0 || input.pathDrag !== null ||
      input.areaDrag !== null)
    return;
  var canvas = document.querySelector(input.canvasID);
  if (!canvas)
    return;
  var box = canvas.getBoundingClientRect();
  var move = edgeScroll(input.mouseX, input.mouseY, box.width, box.height, (now - last) / 1000);
  if (move.dx !== 0 || move.dy !== 0)
    pan(move.dx, move.dy);
};


var commonAnimate = function() {
  if (this.dialogShowing) {
    nextFrame(this.animate);
    return;
  }

  if (!this.isPaused)
    this.simulation.spriteManager.moveObjects(this.simulation._constructSimData());

  // The time of day moves only while the city's time does (not paused, no window open), as fast as the game's speed,
  // and the sun stands where it says (src/dayClock.ts)
  var now = performance.now(), frameSeconds = this._clockAt === null ? 0 : (now - this._clockAt) / 1000;
  this._clockAt = now;
  var month = this.simulation.getDate().month;
  if (!this.isPaused && !this.dialogOpen)
    this.dayClock.advance(frameSeconds, this.simulation._speed, month);
  if (this.cityView && typeof this.cityView.setSunAngle === 'function')
    this.cityView.setSunAngle(this.dayClock.sunAngle(month));
  var sim = this.simulation;
  this.skyNow = skyAt(this.gameMap.weather || null, sim._climate(), sim._cityTime + sim._phaseCycle / 16,
                      this.dayClock.hour, month);
  if (this.cityView && typeof this.cityView.setSky === 'function')
    this.cityView.setSky(this.skyNow);

  // With a line half drawn and the mouse at the edge of the screen, the camera slides that way
  this.edgeScrollView();

  // Run this once per animation frame (even when paused: you can still build when paused)
  this.mouse = this.calculateMouseForPaint();

  // The zones' paint shows clearer while a brush is in hand, and on a map painted a tile at a time the tiles that can take
  // it; never with a road tool, whose drawn line shows what it builds (owner, 21 Oct 2026: "ทำไมยังเห็นรอยเป็นช่องๆ อยู่
  // เราไม่ได้สร้างตามช่องแล้วไม่ใช่เหรอ?"; on 14 Oct it had the cells show while roads were drawn)
  var toolName = this.inputStatus.toolName;
  var zoneGrid = this.gameMap.paintedZones === true && showsZoneGrid(toolName);
  if (zoneGrid !== this._zoneGrid && this.cityView.zoneGrid) {
    this._zoneGrid = zoneGrid;
    this.cityView.zoneGrid(zoneGrid);
  }

  this.cityView.paint(this.mouse, this.spritesIn(this.cityView.visibleTiles()), this.isPaused);
  if (!this._curtainFaded) {
    this._curtainFaded = true;
    fadeCurtain(false, 900);
    // The loading screen fades too, once the surfaces still on their way have come (src/loadingScreen.ts)
    loadingFirstFrame();
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
