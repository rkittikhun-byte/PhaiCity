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

import { Config } from './config.js';
import { hide, show } from './motion.ts';
import { Game } from './game.js';
import { decodePresetCells } from './geo/presetMap.ts';
import { startingFunds } from './geo/provinceProfile.ts';
import { hasSeenIntro, openProvincePicker } from './provincePicker.ts';
import { getLanguage, onLanguageChange, t } from './i18n/index.ts';
import { MapGenerator } from './mapGenerator.js';
import { Simulation } from './simulation.js';
import { SplashCanvas } from './splashCanvas.js';
import { Storage } from './storage.js';

/*
 *
 * The SplashScreen is the first screen the player will see on launch. It is responsible for map generation,
 * placing UI on screen to allow the player to select a map or load a game, and finally launching the game.
 * This should not be called until the tiles and sprites have been loaded.
 *
 */

var onresize = null;

var PROVINCE_ID = /^TH-\d{2}$/;
var MAX_CITY_NAME_LENGTH = 15;


// index.html?province=TH-50 starts from that province's real-geography preset map
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


// Replaces the generated map with the province preset once it has loaded. Until then, or if loading
// fails, the randomly generated map stays in place. Resolves to whether the province loaded.
var loadProvince = function(provinceId) {
  var self = this;

  return Promise.all([
    fetchJson('data/maps/' + provinceId + '.json'),
    fetchJson('data/thailand-provinces.json')
  ]).then(function(results) {
    var preset = results[0];
    var province = results[1].provinces.find(function(p) { return p.id === provinceId; });
    var map = MapGenerator.fromPresetCells(preset.width, preset.height, decodePresetCells(preset));

    map.provinceId = provinceId;
    // Provinces with less open land start with more money (src/geo/provinceProfile.ts)
    map.startingFunds = startingFunds(preset.stats);
    self.map = map;
    self.provinceName = province ? (getLanguage() === 'en' ? province.nameEn : province.nameTh) : null;
    self.splashCanvas.paint(map);
    return true;
  }).catch(function(error) {
    console.warn('Could not load province ' + provinceId + ': ' + error.message);
    return false;
  });
};


// The province picker hands back a province; load it and go straight to naming the city.
// With intro set, the picker first tells the story of Thailand and its regions.
var chooseProvince = function(intro, e) {
  if (e)
    e.preventDefault();
  var self = this;

  openProvincePicker(function(provinceId) {
    loadProvince.call(self, provinceId).then(function(loaded) {
      if (loaded)
        acquireNameAndDifficulty.call(self, {preventDefault: function() {}});
    });
  }, {intro: intro});
};


// "Continue: <city> · <province>" for the saved city, in the current language
var labelContinueButton = function(savedGame) {
  var setLabel = function(provinceName) {
    var city = provinceName && provinceName !== savedGame.name ? savedGame.name + ' · ' + provinceName : savedGame.name;
    $('#splashLoad').text(t('splash.btn.continue', {city: city}));
  };

  setLabel(null);
  if (!savedGame.provinceId)
    return;

  fetchJson('data/thailand-provinces.json').then(function(data) {
    var province = data.provinces.find(function(p) { return p.id === savedGame.provinceId; });
    if (province)
      setLabel(getLanguage() === 'en' ? province.nameEn : province.nameTh);
  }).catch(function() {});
};


// If the window is initially too small, try and relaunch if it gets bigger
var makeResizeListener = function(tileSet, spriteSheet) {
  return function(tileSet, spriteSheet, e) {
    $(window).off('resize');
    var s = new SplashScreen(tileSet, spriteSheet);
  }.bind(null, tileSet, spriteSheet);
};


function SplashScreen(tileSet, snowTileSet, spriteSheet) {
  // We don't launch the game if the screen is too small, however, we should retain the right to do so
  // should the situation change...
  if ($('#tooSmall').is(':visible')) {
    onresize = makeResizeListener(tileSet, spriteSheet);
    $(window).on('resize', onresize);
    return;
  }

  this.tileSet = tileSet;
  this.snowTileSet = snowTileSet;
  this.spriteSheet = spriteSheet;
  this.map = MapGenerator();

  // Set up listeners on buttons. When play is clicked, we will move on to get the player's desired
  // difficulty level and city name before launching the game properly
  $('#splashGenerate').click(regenerateMap.bind(this));
  $('#splashProvince').click(chooseProvince.bind(this, false));
  $('#splashIntro').click(chooseProvince.bind(this, true));
  $('#splashPlay').click(acquireNameAndDifficulty.bind(this));
  $('#splashLoad').click(handleLoad.bind(this));

  // Saving needs storage; "continue" appears only when there is a saved city
  $('#saveRequest').prop('disabled', !Storage.canStore);
  var savedGame = Storage.canStore ? Storage.getSavedGame() : null;
  if (savedGame !== null) {
    $('#splashLoad').prop('disabled', false).prop('hidden', false);
    labelContinueButton(savedGame);
    onLanguageChange(function() { labelContinueButton(savedGame); });
  }

  // Paint the minimap
  this.splashCanvas = new SplashCanvas('splashContainer', tileSet);
  this.splashCanvas.paint(this.map);

  this.provinceName = null;
  var provinceId = getRequestedProvince();
  if (provinceId !== null)
    loadProvince.call(this, provinceId);

  // Let's get some bits on screen!
  $('.awaitGeneration').toggle();
  $('#splashProvince').focus();

  // First launch: tell the story of Thailand, which leads into choosing a region and a province
  if (provinceId === null && !hasSeenIntro())
    chooseProvince.call(this, true);
}


// Generate a new map at the user's request, and paint it
var regenerateMap = function(e) {
  e.preventDefault();

  this.map = MapGenerator();
  this.provinceName = null;
  this.splashCanvas.paint(this.map);
};


// Fetches game data from the storage manager, and launches the game. We won't return from here
var handleLoad = function(e) {
  e.preventDefault();

  var savedGame = Storage.getSavedGame();

  if (savedGame === null)
    return;

  // Remove installed event listeners
  $('#splashLoad').off('click');
  $('#splashGenerate').off('click');
  $('#splashProvince').off('click');
  $('#splashIntro').off('click');
  $('#splashPlay').off('click');

  // Hide the splashscreen UI
  hide($('#splash')[0]);

  // Launch
  var g = new Game(savedGame, this.tileSet, this.snowTileSet, this.spriteSheet, Simulation.LEVEL_EASY, name);
};


// After a map has been selected, call this function to display a form asking the user for
// a city name and difficulty level.
var acquireNameAndDifficulty = function(e) {
  e.preventDefault();

  // Remove the initial event listeners
  $('#splashLoad').off('click');
  $('#splashGenerate').off('click');
  $('#splashProvince').off('click');
  $('#splashIntro').off('click');
  $('#splashPlay').off('click');

  // Get rid of the initial splash screen
  hide($('#splash')[0]);

  // As a convenience, the city name is not mandatory in debug mode
  if (Config.debug)
    $('#nameForm').removeAttr('required');

  // When the form is submitted, we'll be ready to launch the game
  $('#playForm').submit(play.bind(this));

  // A province city is named after its province unless the player changes it
  if (this.provinceName)
    $('#nameForm').val(this.provinceName.slice(0, MAX_CITY_NAME_LENGTH));

  // Display the name and difficulty form
  show($('#start')[0], 'block');
  $('#nameForm').focus();
};


// This function should be called after the name/difficulty form has been submitted. The game will now be launched
// with the map selected earlier.
var play = function(e) {
  e.preventDefault();

  // As usual, uninstall event listeners, and hide the UI
  $('#playForm').off('submit');
  hide($('#start')[0]);

  // What values did the player specify?
  var difficulty = $('.difficulty:checked').val() - 0;
  var name = $('#nameForm').val();

  // Launch a new game
  var g = new Game(this.map, this.tileSet, this.snowTileSet, this.spriteSheet, difficulty, name);
};


export { SplashScreen };
