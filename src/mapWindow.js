/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city map window (#mapWindow in index.html): the whole city at a glance, or its power, water supply,
// groundwater, traffic, pollution, crime, land value, population, and police and fire cover (src/cityMap.ts). The
// white frame is the part on screen; clicking the map closes the window with the tile clicked, and the game takes
// the view there. Only reads the city.

import $ from "jquery";

import { CITY_KEYS, DRY, heatRamp, isMapLayer, KIND_COLOURS, layerPixels, MAP_LAYERS, mapScale, PIPE, POWERED,
         powerCounts, stringId, tileAtPoint, UNPOWERED, WATERED, waterCounts } from './cityMap.ts';
import { onLanguageChange, t } from './i18n/index.ts';
import { MAP_WINDOW_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';

// The layer last looked at, a convenience for this player only
var LAYER_KEY = 'phaicity.mapLayer';


var savedLayer = function() {
  try {
    var layer = window.localStorage.getItem(LAYER_KEY);
    return isMapLayer(layer) ? layer : 'city';
  } catch (e) {
    return 'city';
  }
};


var rgb = function(colour) {
  return 'rgb(' + colour.join(',') + ')';
};


var MapWindow = ModalWindow(function() {
  this._map = null;
  this._overlays = null;
  this._view = null;
  this._layer = savedLayer();
  // Told the layer's picture as the layer changes, or null (the whole city, or the window closed): src/game.js lays it
  // over the 3D ground
  this.onLayer = null;

  $('#mapForm').on('submit', function(e) {
    e.preventDefault();
    this.close(null);
  }.bind(this));

  var layers = document.getElementById('mapLayers');
  MAP_LAYERS.forEach(function(layer) {
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-layer', layer);
    button.addEventListener('click', this._setLayer.bind(this, layer));
    layers.appendChild(button);
  }, this);

  $('#mapCanvas').on('click', function(e) {
    if (this._map === null)
      return;

    var tile = tileAtPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(),
                           this._map.width, this._map.height);
    if (tile !== null)
      this.close(tile);
  }.bind(this));

  this._label();
  onLanguageChange(this._label.bind(this));
});


MapWindow.prototype._setLayer = function(layer) {
  this._layer = layer;
  try {
    window.localStorage.setItem(LAYER_KEY, layer);
  } catch (e) {
    // Remembering the layer is only a convenience
  }
  this._draw();
};


MapWindow.prototype._draw = function() {
  var ground = null;
  if (this._map !== null) {
    var width = this._map.width;
    var height = this._map.height;
    var scale = mapScale(width, height);

    // One pixel per tile, then blown up without smoothing so every tile stays a crisp square
    var tiles = document.createElement('canvas');
    tiles.width = width;
    tiles.height = height;
    tiles.getContext('2d').putImageData(
      new ImageData(layerPixels(this._layer, this._map, this._overlays), width, height), 0, 0);
    // A layer other than the whole city is laid over the city's ground too, as Cities: Skylines' info views (owner,
    // 15 Oct 2026: "คลิกปุ่มใน แผนที่เมือง แล้วให้เห็นใน map ของ ที่กำลังเล่นอยู่ได้ไหม")
    // (in the bare ground's colour under the layer's data: the 3D view draws the roads and buildings themselves)
    if (this._layer !== 'city') {
      ground = document.createElement('canvas');
      ground.width = width;
      ground.height = height;
      ground.getContext('2d').putImageData(
        new ImageData(layerPixels(this._layer, this._map, this._overlays, true), width, height), 0, 0);
    }

    var canvas = document.getElementById('mapCanvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tiles, 0, 0, canvas.width, canvas.height);

    // The part of the city on screen, white on a dark edge so it shows on every layer
    if (this._view !== null) {
      var x = this._view.x0 * scale;
      var y = this._view.y0 * scale;
      var w = (this._view.x1 - this._view.x0 + 1) * scale;
      var h = (this._view.y1 - this._view.y0 + 1) * scale;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'white';
      ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    }
  }

  this._label();
  if (this.onLayer)
    this.onLayer(ground, this._layer);
};


MapWindow.prototype._key = function(colour, text) {
  var key = document.createElement('span');
  key.className = 'mapKey';
  key.style.setProperty('--key', rgb(colour));
  key.textContent = text;
  return key;
};


// The layer buttons, what the layer shows, and what its colours mean, in the current language
MapWindow.prototype._label = function() {
  var current = this._layer;
  $('#mapLayers button').each(function(i, button) {
    var layer = button.getAttribute('data-layer');
    button.textContent = t('map.layer.' + stringId(layer));
    button.setAttribute('aria-pressed', String(layer === current));
  });
  $('#mapAbout').text(t('map.about.' + stringId(current)));

  var items;
  if (current === 'city') {
    items = CITY_KEYS.map(function(kind) {
      return this._key(KIND_COLOURS[kind], t('map.key.' + stringId(kind)));
    }, this);
  } else if (current === 'power') {
    items = [this._key(POWERED, t('map.key.powered')), this._key(UNPOWERED, t('map.key.unpowered'))];
    if (this._map !== null) {
      var count = document.createElement('span');
      count.className = 'mapCount';
      count.textContent = t('map.power_count', powerCounts(this._map));
      items.push(count);
    }
  } else if (current === 'water') {
    items = [this._key(WATERED, t('map.key.watered')), this._key(DRY, t('map.key.dry')),
             this._key(PIPE, t('map.key.pipe'))];
    if (this._map !== null) {
      var waterCount = document.createElement('span');
      waterCount.className = 'mapCount';
      waterCount.textContent = t('map.water_count', waterCounts(this._map, this._overlays && this._overlays.water));
      items.push(waterCount);
    }
  } else {
    var ramp = heatRamp(current);
    var scale = document.createElement('span');
    scale.className = 'mapRamp';
    scale.style.setProperty('--from', rgb(ramp[0]));
    scale.style.setProperty('--to', rgb(ramp[1]));
    var low = document.createElement('span');
    low.textContent = t('map.key.low');
    var high = document.createElement('span');
    high.textContent = t('map.key.high');
    items = [low, scale, high];
  }

  var legend = document.getElementById('mapLegend');
  legend.replaceChildren.apply(legend, items);
};


// map: the game map; overlays: the simulation's block maps; view: the tiles on screen (a TileRect, or null)
MapWindow.prototype.open = function(map, overlays, view) {
  this._map = map;
  this._overlays = overlays;
  this._view = view || null;
  // Drawn first, so the window has its full size when it is placed beside the menu
  this._draw();
  this._toggleDisplay();
  $('#mapOK').focus();
};


// target: the tile clicked, or null when the window just closes
MapWindow.prototype.close = function(target) {
  // The layer leaves the ground with the window
  if (this.onLayer)
    this.onLayer(null);
  this._map = null;
  this._overlays = null;
  this._view = null;
  this._emitEvent(MAP_WINDOW_CLOSED, target || null);
  this._toggleDisplay();
};


export { MapWindow };
