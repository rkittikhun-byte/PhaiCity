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

import { Game } from './game.js';
import { decodePresetCells } from './geo/presetMap.ts';
import { startingFunds } from './geo/provinceProfile.ts';
import { t } from './i18n/index.ts';
import { MapGenerator } from './mapGenerator.js';
import { hasSeenIntro, openStartScreen } from './provincePicker.ts';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';

/*
 *
 * The SplashScreen launches the game once the tiles and sprites have loaded. PhaiCity starts on the dark,
 * full-screen map of Thailand (src/provincePicker.ts): the story on first launch, then a region and a
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
  var savedGame = Storage.canStore ? Storage.getSavedGame() : null;
  var requested = getRequestedProvince();

  openStartScreen({
    saved: savedGame === null ? null : {name: savedGame.name, provinceId: savedGame.provinceId || null},
    start: startProvince.bind(this),
    continueSaved: launch.bind(this, savedGame, Simulation.LEVEL_EASY, null),
    practice: function() {
      launch.call(this, MapGenerator(), Simulation.LEVEL_EASY, t('practice.city'));
    }.bind(this)
  }, {intro: requested === null && !hasSeenIntro(), provinceId: requested});
}


// Builds the province's real-geography map and starts the city on it. We won't return from here.
var startProvince = function(provinceId, cityName, difficulty) {
  var self = this;

  fetchJson('data/maps/' + provinceId + '.json').then(function(preset) {
    var map = MapGenerator.fromPresetCells(preset.width, preset.height, decodePresetCells(preset));
    map.provinceId = provinceId;
    // Provinces with less open land start with more money (src/geo/provinceProfile.ts)
    map.startingFunds = startingFunds(preset.stats);
    launch.call(self, map, difficulty, cityName);
  }).catch(function(error) {
    // Without its map the province can't be played; a random practice map is better than nothing
    console.warn('Could not load province ' + provinceId + ': ' + error.message);
    launch.call(self, MapGenerator(), difficulty, cityName);
  });
};


// A saved game brings its own name and difficulty
var launch = function(map, difficulty, name) {
  var g = new Game(map, this.tileSet, this.snowTileSet, this.spriteSheet, difficulty, name);
};


export { SplashScreen };
