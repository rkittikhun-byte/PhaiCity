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

import { deleteCity, listCities, loadCity } from './cityStorage.ts';
import { chooseViewKind } from './cityViewChoice.ts';
import { loadCityView3D } from './cityView3dLoader.ts';
import { showCornerNote } from './cornerNote.ts';
import { Game } from './game.js';
import { decodePresetCells, decodePresetHeights, decodePresetLayer } from './geo/presetMap.ts';
import { startingFunds } from './geo/provinceProfile.ts';
import { t } from './i18n/index.ts';
import { MapGenerator } from './mapGenerator.js';
import { openStartScreen } from './provincePicker.ts';
import { showTitleGate } from './titleGate.ts';
import { checkRulesData, resolveRules } from './provinceRules.ts';
import { requestedCity } from './viewControls.ts';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';

/*
 *
 * The SplashScreen launches the game once the tiles and sprites have loaded. PhaiCity starts on the dark,
 * full-screen map of Thailand (src/provincePicker.ts): the story each time the game opens, then a region and a
 * province. From there the player starts a province city, continues the saved city, or practises on a
 * random map.
 *
 */

var onresize = null;

var PROVINCE_ID = /^TH-\d{2}$/;


// index.html?province=TH-50 opens straight on that province
var getRequestedProvince = function() {
  var id = new URLSearchParams(window.location.search).get('province');
  return id !== null && PROVINCE_ID.test(id) ? id : null;
};


var fetchJson = function(url) {
  return fetch(url).then(function(response) {
    if (!response.ok)
      throw new Error(url + ' returned ' + response.status);
    return response.json();
  });
};


// If the window is initially too small, try and relaunch if it gets bigger
var makeResizeListener = function(tileSet, snowTileSet, spriteSheet) {
  return function() {
    $(window).off('resize');
    var s = new SplashScreen(tileSet, snowTileSet, spriteSheet);
  };
};


function SplashScreen(tileSet, snowTileSet, spriteSheet) {
  // We don't launch the game if the screen is too small, however, we should retain the right to do so
  // should the situation change...
  if ($('#tooSmall').is(':visible')) {
    onresize = makeResizeListener(tileSet, snowTileSet, spriteSheet);
    $(window).on('resize', onresize);
    return;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.spriteSheet = spriteSheet;

  $('#saveRequest').prop('disabled', !Storage.canStore);

  // index.html?city=<id> opens a saved city straight away (src/viewControls.ts)
  var cityId = requestedCity(window.location.search);
  var cityToOpen = cityId !== null ? loadCity(cityId) : null;
  if (cityToOpen !== null) {
    launch.call(this, cityToOpen, Simulation.LEVEL_EASY, null);
    return;
  }

  var requested = getRequestedProvince();

  openStartScreen({
    cities: listCities(),
    start: startProvince.bind(this),
    // A saved city brings its own name and difficulty
    continueCity: function(id) {
      var savedGame = loadCity(id);
      if (savedGame !== null)
        launch.call(this, savedGame, Simulation.LEVEL_EASY, null);
    }.bind(this),
    deleteCity: deleteCity,
    practice: function() {
      launch.call(this, MapGenerator(), Simulation.LEVEL_EASY, t('practice.city'));
    }.bind(this)
  // The opening story plays every time the game opens, and can be skipped (owner decision, 11 Oct 2026), after the
  // title page whose "Enter the game" click lets the music start at once (src/titleGate.ts, owner 12 Oct 2026)
  }, {intro: requested === null, provinceId: requested, gate: requested === null ? showTitleGate() : null});
}


// Builds the province's real-geography map and starts the city on it. We won't return from here.
// A whole-province map (format 2) also brings its railways and roads to the neighbours, which tiles are in the
// province (only those can be built on) and the town the camera starts at (docs/geo/GEO_SPEC.md section 10).
var startProvince = function(provinceId, cityName, difficulty) {
  var self = this;

  fetchJson('data/maps/' + provinceId + '.json').then(function(preset) {
    var layer = function(encoded) {
      return encoded ? decodePresetLayer(encoded, preset.width, preset.height) : null;
    };
    var transport = layer(preset.transport);
    var map = MapGenerator.fromPresetCells(preset.width, preset.height, decodePresetCells(preset), transport);
    // The roads and railways it starts with are the state's: the city pays nothing for them and they never wear out
    map.nationalTransport = transport;
    map.insideProvince = layer(preset.inside);
    map.town = preset.town || null;
    map.provinceId = provinceId;
    map.tileSizeM = preset.tileSizeM || null;
    // Provinces with less open land start with more money (src/geo/provinceProfile.ts)
    map.startingFunds = startingFunds(preset.stats);
    return decodePresetHeights(preset).then(function(heights) {
      map.heights = heights;
      launch.call(self, map, difficulty, cityName);
    });
  }).catch(function(error) {
    // Without its map the province can't be played; a random practice map is better than nothing
    console.warn('Could not load province ' + provinceId + ': ' + error.message);
    launch.call(self, MapGenerator(), difficulty, cityName);
  });
};


// The region a city's buildings are styled after; practice maps use the central style (MODEL_SPEC 6A)
var regionOf = function(provinceId) {
  if (!provinceId)
    return Promise.resolve('central');

  return fetchJson('data/thailand-provinces.json').then(function(data) {
    var province = data.provinces.find(function(p) { return p.id === provinceId; });
    return province ? province.region : 'central';
  }).catch(function() {
    return 'central';
  });
};


// The 3D view's factory and the region (src/cityViewChoice.ts: 3D is the game's view), or null for the 2D view:
// with index.html?view=2d, or when the 3D view is missing from the build (a corner note says so)
var prepareView = function(provinceId) {
  if (chooseViewKind(window.location.search) !== '3d')
    return Promise.resolve(null);

  return Promise.all([loadCityView3D(), regionOf(provinceId)]).then(function(results) {
    if (results[0] === null) {
      showCornerNote(t('view.3d_missing'), 6000);
      return null;
    }
    return {create: results[0], region: results[1]};
  });
};


// The rules a province's city plays by (src/provinceRules.ts): its region's and its own, from
// data/province-rules.json (the server's, once the game is online). A practice map, or rules that cannot be read,
// play by the game's own.
var loadRules = function(provinceId) {
  if (!provinceId)
    return Promise.resolve(null);

  return Promise.all([fetchJson('data/province-rules.json'), regionOf(provinceId)]).then(function(results) {
    var checked = checkRulesData(results[0]);
    if (checked.problems.length > 0)
      console.warn('Province rules: ' + checked.problems.join('; '));
    return resolveRules(checked.data, results[1], provinceId);
  }).catch(function(error) {
    console.warn('Could not load the province rules: ' + error.message);
    return null;
  });
};


// A saved city of a province takes its ground's heights from the province's map, as saves do not keep them; for the
// 3D view's hills (docs/3d/RENDERER_SPEC.md section 6B). Nothing comes back for a practice map, a new city (whose
// map already has them) or a map that cannot be read.
var savedCityHeights = function(map) {
  if (!map.isSavedGame || !map.provinceId)
    return Promise.resolve();
  return fetchJson('data/maps/' + map.provinceId + '.json').then(function(preset) {
    if (preset.width !== map.width || preset.height !== map.height)
      return;
    map.tileSizeM = preset.tileSizeM || null;
    return decodePresetHeights(preset).then(function(heights) { map.heights = heights; });
  }).catch(function(error) {
    console.warn('No heights for ' + map.provinceId + ': ' + error.message);
  });
};


// A saved game brings its own name and difficulty
var launch = function(map, difficulty, name) {
  var self = this;
  // Leave the dark start: the game's own header, footer and background come back
  document.body.classList.remove('starting');
  // The footer was hidden until now: let the game area fit itself above it (src/micropolis.js)
  window.dispatchEvent(new Event('resize'));
  var provinceId = map.provinceId || null;
  Promise.all([prepareView(provinceId), loadRules(provinceId), savedCityHeights(map)]).then(function(results) {
    var g = new Game(map, self.tileSet, self.snowTileSet, self.spriteSheet, difficulty, name, results[0], results[1]);
  });
};


export { SplashScreen };
