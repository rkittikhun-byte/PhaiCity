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

import { deleteCity, listCities, loadCityAsync } from './cityStorage.ts';
import { chooseViewKind } from './cityViewChoice.ts';
import { loadCityView3D } from './cityView3dLoader.ts';
import { showCornerNote } from './cornerNote.ts';
import { Game } from './game.js';
import { decodePresetCells, decodePresetHeights, decodePresetLayer, decodePresetLayerWide } from './geo/presetMap.ts';
import { firstFrame } from './cityFrame.ts';
import { DISTRICT_BLOCK, framePreset, isDistrictMap, presetHeights } from './geo/districtFrame.ts';
import { startingFunds } from './geo/provinceProfile.ts';
import { getLanguage, t } from './i18n/index.ts';
import { MapGenerator } from './mapGenerator.js';
import { openStartScreen } from './provincePicker.ts';
import { showTitleGate } from './titleGate.ts';
import { checkRulesData, resolveRules } from './provinceRules.ts';
import { checkProfilesData, measuredLevels, provinceLevels } from './geo/provinceResources.ts';
import { requestedCity } from './viewControls.ts';
import { Simulation } from './simulation.js';
import { Storage } from './storage.js';
import { setCurtainDark } from './curtain.ts';
import { loadingStep, markLoadingStep, showLoadingScreen } from './loadingScreen.ts';

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

// index.html?district=TH-40-mueang-khon-kaen or ?khonkaen opens straight on that real-scale district
var getRequestedDistrict = function() {
  var params = new URLSearchParams(window.location.search);
  var district = params.get('district');
  if (district) return district;
  if (params.has('khonkaen') || params.has('kkc')) return 'TH-40-mueang-khon-kaen';
  return null;
};


// A province with a real-scale city map (16 m a tile round its town, docs/CITY_SCALE.md) starts there: Khon Kaen first,
// then one province at a time (owner 13 Oct 2026, "เอาขอนแก่นก่อน แล้วค่อยๆ ขยาย"). index.html?scale=province starts the
// whole province scaled down instead, and ?scale=city asks for a city map that is not listed yet
var CITY_MAPS = ['TH-40'];
var cityScale = function(provinceId) {
  var scale = new URLSearchParams(window.location.search).get('scale');
  return scale === 'city' || (scale !== 'province' && CITY_MAPS.indexOf(provinceId) !== -1);
};
var mapUrl = function(provinceId, city) {
  return 'data/maps/' + (city ? 'city/' : '') + provinceId + '.json';
};
var districtUrl = function(districtId) {
  return 'data/maps/district/' + districtId + '.json';
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

  // index.html?city=<id> opens a saved city straight away (src/viewControls.ts), read from the city database
  var cityId = requestedCity(window.location.search);
  if (cityId !== null) {
    var self = this;
    loadCityAsync(cityId).then(function(cityToOpen) {
      if (cityToOpen !== null)
        launch.call(self, cityToOpen, Simulation.LEVEL_EASY, null, 'saved');
      else
        openStart.call(self);
    });
    return;
  }
  openStart.call(this);
}


// The start screen, or a district straight away (index.html?district=…)
var openStart = function() {
  var reqDistrict = getRequestedDistrict();
  if (reqDistrict) {
    var provId = reqDistrict.slice(0, 5);
    // (a new city plays the normal mode unless its player chose another, src/gameModes.ts), named after its
    // province in the player's language
    var self = this;
    provinceName(provId).then(function(name) {
      startProvince.call(self, provId, name, Simulation.LEVEL_MED, reqDistrict);
    });
    return;
  }

  var requested = getRequestedProvince();

  openStartScreen({
    cities: listCities(),
    start: startProvince.bind(this),
    // A saved city brings its own name and difficulty
    continueCity: function(id) {
      loadCityAsync(id).then(function(savedGame) {
        if (savedGame !== null)
          launch.call(this, savedGame, Simulation.LEVEL_EASY, null, 'saved');
      }.bind(this));
    }.bind(this),
    deleteCity: deleteCity,
    practice: function() {
      launch.call(this, MapGenerator(), Simulation.LEVEL_MED, t('practice.city'), 'practice');
    }.bind(this)
  // The opening story plays every time the game opens, and can be skipped (owner decision, 11 Oct 2026), after the
  // title page whose "Enter the game" click lets the music start at once (src/titleGate.ts, owner 12 Oct 2026)
  }, {intro: requested === null, provinceId: requested, gate: requested === null ? showTitleGate() : null});
};


// Builds the province's real-geography map and starts the city on it. We won't return from here.
// A whole-province map (format 2) also brings its railways and roads to the neighbours, which tiles are in the
// province (only those can be built on) and the town the camera starts at (docs/geo/GEO_SPEC.md section 10).
// districtId (owner 13 Oct 2026, Khon Kaen first): the district whose town the city stands in, on its own real-scale
// map (data/maps/district/<id>.json, npm run geo:city -- --districts)
var startProvince = function(provinceId, cityName, difficulty, districtId) {
  var self = this;
  // What loads shows on the loading screen, with the region's music (src/loadingScreen.ts)
  showLoadingScreen({city: cityName, provinceId: provinceId, source: 'province'});

  loadingStep('map', fetchJson(districtId ? districtUrl(districtId) : mapUrl(provinceId, cityScale(provinceId))))
      .then(function(whole) {
    // A district's map is the whole district; the city plays a frame of it round its town, which grows as it buys
    // land (docs/DISTRICT_FRAME.md)
    return isDistrictMap(whole) ? framePreset(whole, firstFrame(whole, whole.town, DISTRICT_BLOCK)) : whole;
  }).then(function(preset) {
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
    map.districtId = preset.districtId || null;
    map.tileSizeM = preset.tileSizeM || null;
    // Where the map lies on the earth, to lay the province round a district's map (loadProvinceBackdrop)
    map.mapCenter = preset.center || null;
    // ... and, on a district's map, the frame of it the city plays and the district's own size and middle
    map.frame = preset.frame || null;
    map.districtPlace = preset.district || null;
    // A whole district's map is painted a tile at a time too (owner, 14 Oct 2026; docs/ZONE_PAINT.md), or a cell at a
    // time along its roads (src/zoneCells.ts; Mueang Khon Kaen first)
    map.paintedZones = preset.paintedZones === true;
    map.cellZones = preset.cellZones === true;
    // A real-scale city map's real streets: their levels, and their names for the street labels (src/streetNames.ts)
    map.roadLevels = layer(preset.roadLevels);
    streetNamesFrom(map, preset);
    // Provinces with less open land start with more money (src/geo/provinceProfile.ts)
    map.startingFunds = startingFunds(preset.stats);
    return loadingStep('heights', presetHeights(preset)).then(function(heights) {
      map.heights = heights;
      launch.call(self, map, difficulty, cityName, 'province');
    });
  }).catch(function(error) {
    // Without its map the province can't be played; a random practice map is better than nothing
    console.warn('Could not load province ' + provinceId + ': ' + error.message);
    markLoadingStep('map', 'failed');
    markLoadingStep('heights', 'failed');
    launch.call(self, MapGenerator(), difficulty, cityName, 'practice');
  });
};


// A province's name in the player's language, or its id when the list cannot be read
var provinceName = function(provinceId) {
  return fetchJson('data/thailand-provinces.json').then(function(data) {
    var province = data.provinces.find(function(p) { return p.id === provinceId; });
    return province ? (getLanguage() === 'en' ? province.nameEn : province.nameTh) : provinceId;
  }).catch(function() {
    return provinceId;
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


// The province's resource levels, 0–5 by id (src/geo/provinceResources.ts): the owner's, the game's inference or
// the measurements. Tourism counts in the game so far (src/tourism.ts). None for a practice map, or files that
// cannot be read.
var loadResources = function(provinceId) {
  if (!provinceId)
    return Promise.resolve(null);

  return Promise.all([fetchJson('data/geo/province-indicators.json'), fetchJson('data/province-profiles.json')])
    .then(function(results) {
      var measured = measuredLevels(results[0].provinces);
      var entry = checkProfilesData(results[1]).data.provinces[provinceId];
      var levels = {};
      provinceLevels(measured[provinceId], entry).forEach(function(resource) { levels[resource.id] = resource.level; });
      return levels;
    }).catch(function(error) {
      console.warn('Could not load the province resources: ' + error.message);
      return null;
    });
};


// The real names of a city map's streets (docs/GAME_PLAN.md decision 17): each road tile's street, and the names
var streetNamesFrom = function(map, preset) {
  map.roadNames = preset.roadNames && preset.streetNames ?
    decodePresetLayerWide(preset.roadNames, preset.width, preset.height) : null;
  map.streetNameList = map.roadNames ? preset.streetNames : null;
  // ... and what covers the open land (paddy, fields, villages; docs/GAME_PLAN.md phase 4), not kept by saves either
  map.landCover = preset.landCover ? decodePresetLayer(preset.landCover, preset.width, preset.height) : null;
};


// A saved city of a province takes its ground's heights from the province's map, as saves do not keep them; for the
// 3D view's hills (docs/3d/RENDERER_SPEC.md section 6B). Nothing comes back for a practice map, a new city (whose
// map already has them) or a map that cannot be read.
var savedCityHeights = function(map) {
  if (!map.isSavedGame || !map.provinceId)
    return Promise.resolve();
  // A city saved on a real-scale city map takes them from that map (docs/CITY_SCALE.md)
  var heightsFrom = function(preset) {
    // A city saved on a map since rebuilt at another size (a district's square of 13 Oct, now the whole district)
    // keeps its own tiles and goes without the map's heights, names and land cover
    if (preset.width !== map.width || preset.height !== map.height)
      return Promise.resolve();
    map.tileSizeM = preset.tileSizeM || null;
    map.mapCenter = preset.center || null;
    map.districtPlace = preset.district || null;
    // ... and its streets' real names, which saves do not keep either
    streetNamesFrom(map, preset);
    return presetHeights(preset).then(function(heights) { map.heights = heights; });
  };
  // ... and a district's city from its district's map, cut to the frame it plays (docs/DISTRICT_FRAME.md)
  if (map.districtId) {
    return fetchJson(districtUrl(map.districtId)).then(function(whole) {
      return map.frame && isDistrictMap(whole) ? framePreset(whole, map.frame) : whole;
    }).then(heightsFrom).catch(function(error) {
      console.warn('No heights for ' + map.districtId + ': ' + error.message);
    });
  }
  return fetchJson(mapUrl(map.provinceId, false)).then(function(preset) {
    if (preset.width !== map.width || preset.height !== map.height)
      return fetchJson(mapUrl(map.provinceId, true)).then(function(city) {
        if (city.width === map.width && city.height === map.height)
          return heightsFrom(city);
      }, function() {});
    return heightsFrom(preset);
  }).catch(function(error) {
    console.warn('No heights for ' + map.provinceId + ': ' + error.message);
  });
};


// The whole province round a district's city, so the player can zoom out over all of it (owner, 14 Oct 2026:
// "ในตอนเลือก อ. เมืองแล้ว และอยากดู view ทั้งขอนแก่นอีกที แบบ zoom ออก มา ก็สามารถทำได้ด้วยนะ"): the province's own
// map and its districts' outlines, for the 3D view only (src/render3d/city/provinceBackdrop.ts). Nothing for a city
// that is not on a district's map, or when they cannot be read.
var loadProvinceBackdrop = function(map) {
  if (!map.districtId || !map.provinceId || !map.mapCenter || !map.tileSizeM)
    return Promise.resolve();
  return Promise.all([fetchJson(mapUrl(map.provinceId, false)), fetchJson('data/maps/district/index.json')])
      .then(function(results) {
    var province = results[0];
    var districts = (results[1][map.provinceId] || []).map(function(district) {
      var outline = district.outline || {};
      var polygons = outline.type === 'MultiPolygon' ? outline.coordinates :
        outline.type === 'Polygon' ? [outline.coordinates] : [];
      return {id: district.id, rings: [].concat.apply([], polygons)};
    });
    return decodePresetHeights(province).then(function(heights) {
      map.provinceBackdrop = {
        backdrop: {
          width: province.width, height: province.height, tileSizeM: province.tileSizeM, center: province.center,
          cells: decodePresetCells(province),
          inside: province.inside ? decodePresetLayer(province.inside, province.width, province.height) : null,
          heights: heights, districts: districts, districtId: map.districtId
        },
        district: {center: map.mapCenter, width: map.width, height: map.height, tileSizeM: map.tileSizeM}
      };
    });
  }).catch(function(error) {
    console.warn('No province round ' + map.districtId + ': ' + error.message);
  });
};


// A saved game brings its own name and difficulty; source says where the city comes from, for the loading screen:
// 'province', 'saved' or 'practice'
var launch = function(map, difficulty, name, source) {
  var self = this;
  setCurtainDark();
  // Leave the dark start: the game's own header, footer and background come back
  document.body.classList.remove('starting');
  // The footer was hidden until now: let the game area fit itself above it (src/micropolis.js)
  window.dispatchEvent(new Event('resize'));
  var provinceId = map.provinceId || null;
  // A saved or practice city opens the loading screen here; a province's opened it before its map
  showLoadingScreen({city: name || map.name || null, provinceId: provinceId, source: source || 'saved'});
  // A saved city or a practice map is already in hand
  if (source !== 'province') markLoadingStep('map', 'done');
  Promise.all([loadingStep('view', prepareView(provinceId)), loadingStep('rules', loadRules(provinceId)),
               loadingStep('ground', savedCityHeights(map).then(function() { return loadProvinceBackdrop(map); })),
               loadingStep('resources', loadResources(provinceId))])
      .then(function(results) {
    // The city is built in one go, which holds the page: the screen says so first
    markLoadingStep('city', 'loading');
    window.setTimeout(function() {
      new Game(map, self.tileSet, self.snowTileSet, self.spriteSheet, difficulty, name, results[0], results[1],
               results[3]);
      markLoadingStep('city', 'done');
      // ... then the 3D view lays its roads, trees and buildings until its first picture (game.js animate)
      markLoadingStep('world', 'loading');
    }, 40);
  });
};


export { SplashScreen };
