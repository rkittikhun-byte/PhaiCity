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
import { CityCommands, OUTSIDE_PROVINCE, placeProblem } from './cityCommands.ts';
import { showDemandAndPeople } from './cityStatus.ts';
import { areaCentres, areaFootprint, SPRITE_UNITS_PER_TILE } from './cityView.ts';
import { createCityView2D } from './cityView2d.ts';
import { showCornerNote, showCornerNoteOnce } from './cornerNote.ts';
import { Config } from './config.js';
import { CongratsWindow } from './congratsWindow.js';
import { DebugWindow } from './debugWindow.js';
import { DisasterWindow } from './disasterWindow.js';
import { EvaluationWindow } from './evaluationWindow.js';
import { GameMap } from './gameMap.js';
import { decodePresetLayer, encodePresetLayer } from './geo/presetMap.ts';
import { GraphWindow } from './graphWindow.js';
import { formatMoney, onLanguageChange, t } from './i18n/index.ts';
import { InfoBar } from './infoBar.js';
import { InputStatus } from './inputStatus.js';
import { MainMenuWindow } from './mainMenuWindow.js';
import { listCities, saveCity, StorageFullError } from './cityStorage.ts';
import { MapWindow } from './mapWindow.js';
import { toolPrices } from './provinceRules.ts';
import { showToolPrices } from './toolShortcuts.ts';
import { installMousePan, installViewControls, panOf, setViewHome } from './viewControls.ts';
import * as Messages from './messages.ts';
import { MonsterTV } from './monsterTV.js';
import { installNewsLog } from './newsLog.ts';
import { NagWindow } from './nagWindow.js';
import { Notification } from './notification.js';
import { QueryWindow } from './queryWindow.js';
import { Random } from './random.ts';
import { RCI } from './rci.js';
import { installRulerGoals } from './rulerGoals.ts';
import { keepHigherRank, rankForCityClass } from './rulerRank.ts';
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

// Each size the city can reach, with its city class (src/evaluation.js), which sets the ruler's rank
var MILESTONES = {};
MILESTONES[Messages.REACHED_TOWN] = {name: 'town', cityClass: 'TOWN'};
MILESTONES[Messages.REACHED_CITY] = {name: 'city', cityClass: 'CITY'};
MILESTONES[Messages.REACHED_CAPITAL] = {name: 'capital', cityClass: 'CAPITAL'};
MILESTONES[Messages.REACHED_METROPOLIS] = {name: 'metropolis', cityClass: 'METROPOLIS'};
MILESTONES[Messages.REACHED_MEGALOPOLIS] = {name: 'megalopolis', cityClass: 'MEGALOPOLIS'};


// view3d: null for the original 2D view, or {create, region} for the three.js view (src/splashScreen.js prepareView)
// rules: the province's rules (src/provinceRules.ts), or null for the game's own
function Game(gameMap, tileSet, snowTileSet, spriteSheet, difficulty, name, view3d, rules) {
  difficulty = difficulty || 0;
  var savedGame;

  if (!gameMap.isSavedGame) {
    this.gameMap = gameMap;
    savedGame = null;
  } else {
    // Province maps are larger than the classic 120x100, so size the map from the save itself
    this.gameMap = new GameMap(gameMap.width || 120, gameMap.height || 100);
    savedGame = gameMap;
  }

  // Which province and online world this city belongs to (both null for offline random maps)
  var source = savedGame || gameMap;
  this.provinceId = source.provinceId || null;
  // Which saved city this is (src/cityStorage.ts); a new city gets its id when first saved
  this.cityId = savedGame ? savedGame.cityId || null : null;
  // When the city was last saved, for the main menu (ms since 1970, null for a city never saved)
  var savedMeta = this.cityId ? listCities().find(function(city) { return city.id === this.cityId; }, this) : null;
  this.lastSavedAt = savedMeta ? savedMeta.savedAt : null;
  this.worldId = source.worldId || null;
  // A whole-province map: which tiles are the province's, the only ones that can be built on, and its town, where
  // the camera starts (docs/geo/GEO_SPEC.md section 10). A new city brings them on its map, a saved one in its save.
  if (savedGame) {
    this.gameMap.insideProvince = savedGame.inside ?
      decodePresetLayer(savedGame.inside, this.gameMap.width, this.gameMap.height) : null;
    this.gameMap.town = savedGame.town || null;
    // The roads and railways the map started with, which are the state's (src/gameMap.js isNationalTransport)
    this.gameMap.nationalTransport = savedGame.national ?
      decodePresetLayer(savedGame.national, this.gameMap.width, this.gameMap.height) : null;
    // The ground's heights come from the province's map, not the save (src/splashScreen.js savedCityHeights)
    this.gameMap.heights = savedGame.heights || null;
    this.gameMap.tileSizeM = savedGame.tileSizeM || null;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.defaultSpeed = Simulation.SPEED_MED;
  this.simulation = new Simulation(this.gameMap, difficulty, this.defaultSpeed, savedGame, rules || null);

  // A new province city starts with that province's treasury (src/geo/provinceProfile.ts)
  if (!savedGame && gameMap.startingFunds)
    this.simulation.budget.setFunds(gameMap.startingFunds);

  this.name = name || 'MyTown';
  this.everClicked = false;

  if (savedGame)
    this.load(savedGame);

  // The ruler's rank follows the city's size and is never lost (src/rulerRank.ts); older saves have none yet
  this.rulerRank = keepHigherRank(savedGame ? savedGame.rulerRank : null,
                                  rankForCityClass(this.simulation.evaluation.cityClass));

  this.rci = new RCI('RCIContainer', this.simulation);
  // The same demand, as percentages with the people in homes, shops and factories, in the status (src/cityStatus.ts)
  showDemandAndPeople(this.simulation);

  // What draws the city (src/cityView.ts); the game talks to it in map tiles only.
  // Note: must create the view before inputStatus, which listens to the view's canvas
  this.cityView = view3d ? createView3D(this, view3d) : null;
  if (this.cityView === null)
    this.cityView = createCityView2D('canvasContainer', this.gameMap, this.tileSet, spriteSheet);
  this.inputStatus = new InputStatus(this.gameMap, tileSet.tileWidth, this.simulation.rules);
  // The tool buttons show this province's prices
  showToolPrices(toolPrices(this.simulation.rules));

  // Every change the player makes goes through this one entry point as a plain command (src/cityCommands.ts)
  var simulation = this.simulation;
  this.commands = new CityCommands({
    width: this.gameMap.width,
    height: this.gameMap.height,
    tools: this.inputStatus.gameTools,
    get blockMaps() { return simulation.blockMaps; },
    budget: simulation.budget,
    disasters: simulation.disasterManager,
    sprites: simulation.spriteManager,
    setSpeed: simulation.setSpeed.bind(simulation),
    setAutoBulldoze: BaseTool.setAutoBulldoze,
    // For undo: the map to put back, and the time, as only recent building can be undone
    map: this.gameMap,
    cityTime: function() { return simulation._cityTime; },
    canBuildAt: canBuildIn(this.gameMap)
  });

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
    return [this.gameMap, this.simulation.blockMaps, this.cityView.visibleTiles()];
  }.bind(this));

  this.mapWindow = new MapWindow(opacityLayerID, 'mapWindow');
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
      taxesCollected: this.simulation.budget.taxFund
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

  // The 3D view's turn and reset buttons, and sliding the city with the mouse when no tool is in hand
  // (src/viewControls.ts), with a note on the mouse the first time
  installViewControls(this.cityView);
  // A whole-province city opens on its town, and ⌂ brings the camera back there
  var town = this.gameMap.town || null;
  setViewHome(town);
  if (town !== null)
    this.cityView.centreOn(town.x, town.y);
  installMousePan(this.cityView, function() { return self.inputStatus.currentTool !== null; });
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


// Saves this city in its own slot. Returns false when the browser's storage is full.
Game.prototype.save = function() {
  var saveData = {name: this.name, everClicked: this.everClicked,
                  provinceId: this.provinceId, worldId: this.worldId, rulerRank: this.rulerRank,
                  goals: this.rulerGoals.state(), news: this.newsLog.items(),
                  // A whole-province map's own tiles and town (run-length encoded like the map)
                  inside: this.gameMap.insideProvince ? encodePresetLayer(this.gameMap.insideProvince) : undefined,
                  town: this.gameMap.town || undefined,
                  national: this.gameMap.nationalTransport ? encodePresetLayer(this.gameMap.nationalTransport) : undefined};
  BaseTool.save(saveData);
  this.simulation.save(saveData);

  var date = this.simulation.getDate();
  try {
    this.cityId = saveCity(saveData, {
      name: this.name, provinceId: this.provinceId, worldId: this.worldId,
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


Game.prototype.load = function(saveData) {
  this.name = saveData.name;
  this.everClicked = saveData.everClicked;
  BaseTool.load(saveData);
  this.simulation.load(saveData);
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
      overlays: {
        trafficDensityMap: maps.trafficDensityMap,
        pollutionDensityMap: maps.pollutionDensityMap,
        landValueMap: maps.landValueMap
      },
      date: function() { return simulation.getDate(); }
    });
  } catch (e) {
    console.warn('The 3D city view could not start:', e);
    showCornerNote(t('view.3d_failed'), 8000);
    return null;
  }
};


// The one way the player changes the city (src/cityCommands.ts)
Game.prototype.applyCommand = function(command) {
  var outcome = this.commands.apply(command);
  // Building outside the province is refused all the time, and says so where the player looks (handleTool)
  if (!outcome.accepted && outcome.reason !== OUTSIDE_PROVINCE)
    console.warn('Command refused: ' + outcome.reason, command);
  return outcome;
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
      yearEnd: this.simNeededBudget
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

  var tool = this.inputStatus.currentTool;
  var toolName = this.inputStatus.toolName;
  var result;

  if (toolName === 'query') {
    // Looking at a tile changes nothing, so it is not a command
    tool.doTool(tileCoords.x, tileCoords.y, this.simulation.blockMaps);
    result = tool.result;
  } else {
    var outcome = this.applyCommand({type: 'tool', tool: toolName, x: tileCoords.x, y: tileCoords.y,
                                     stroke: data.stroke});
    result = outcome.toolResult;
    if (outcome.reason === OUTSIDE_PROVINCE) {
      showCornerNote(t('tool.outside_province'), OUTSIDE_NOTE_MS);
      this.gameAudio.toolUsed(toolName, tool.TOOLRESULT_FAILED, x);
      return;
    }
  }

  this.showToolResult(tool, result);
  this.gameAudio.toolUsed(toolName, result, x);
  this.refreshUndo();
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


// The tool's outline under the mouse, in map tiles (src/cityView.ts ToolHover), or null
Game.prototype.calculateMouseForPaint = function() {
  if (this.inputStatus.mouseX === -1 || !(this.inputStatus.toolWidth > 0))
    return null;

  var tile = this.cityView.tileAt(this.inputStatus.mouseX, this.inputStatus.mouseY);
  if (tile === null)
    return null;

  // The inputStatus fields came from DOM attributes, so will be strings. Coerce back to numbers.
  var hover = {tile: tile, size: this.inputStatus.toolWidth - 0, colour: this.inputStatus.toolColour || 'yellow'};
  // Red where the tool would reach outside the province, which cannot be built on
  if (placeProblem({canBuildAt: canBuildIn(this.gameMap)}, tile.x, tile.y, hover.size) !== null)
    hover.colour = OUTSIDE_COLOUR;

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


// A zone tool's dragged area, released: a zone at each centre, all one stroke so they undo together
Game.prototype.handleToolArea = function(data) {
  var toolName = this.inputStatus.toolName;
  var tool = this.inputStatus.currentTool;
  if (tool === null)
    return;

  var centres = this.areaCentresFor(data, this.inputStatus.toolWidth - 0);
  if (centres === null)
    return;

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
    window.setTimeout(this.tick, 0);
    return;
  }

  if (!this.simulation.isPaused() && !$('#tooSmall').is(':visible')) {
    // Run the sim
    this.simulation.simTick();
  }

  // Run this even when paused: you can still build when paused
  this.mouse = this.calculateMouseForPaint();

  window.setTimeout(this.tick, 0);
};


var commonAnimate = function() {
  if (this.dialogShowing) {
    nextFrame(this.animate);
    return;
  }

  if (!this.isPaused)
    this.simulation.spriteManager.moveObjects(this.simulation._constructSimData());

  this.cityView.paint(this.mouse, this.spritesIn(this.cityView.visibleTiles()), this.isPaused);

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
