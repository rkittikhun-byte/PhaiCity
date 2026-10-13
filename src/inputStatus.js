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

import { EventEmitter } from './eventEmitter.js';
import { GameCanvas } from './gameCanvas.js';
import { GameTools } from './gameTools.js';
import { t } from './i18n/index.ts';
import * as Messages from './messages.ts';
import { MiscUtils } from './miscUtils.js';

// rules (PhaiCity): the province's rules, for the tools' prices (src/provinceRules.ts)
var InputStatus = EventEmitter(function(map, tileWidth, rules) {
  this.gameTools = new GameTools(map, rules);

  this.gameTools.addEventListener(Messages.QUERY_WINDOW_NEEDED, MiscUtils.reflectEvent.bind(this, Messages.QUERY_WINDOW_NEEDED));

  this.canvasID = MiscUtils.normaliseDOMid(canvasID);

  this._tileWidth = tileWidth;

  // Keyboard Movement
  this.up = false;
  this.down = false;
  this.left = false;
  this.right = false;
  this.escape = false;

  // Mouse movement
  this.mouseX = -1;
  this.mouseY = -1;

  // Mouse drags
  this._dragging = false;
  this._lastdragX = -1;
  this._lastdragY = -1;
  // PhaiCity: the press of the mouse now going on (each press is one undo step), and the area being dragged
  // by a zone tool ({from, to} in canvas pixels) or null
  this.stroke = 0;
  this.areaDrag = null;

  // Tool buttons
  this.toolName = null;
  this.currentTool = null;
  this.toolWidth = 0;
  this.toolColour = '';

  // Add the listeners
  $(document).keydown(keyDownHandler.bind(this));
  $(document).keyup(keyUpHandler.bind(this));

  this.getRelativeCoordinates = getRelativeCoordinates.bind(this);
  $(this.canvasID).on('mouseenter', mouseEnterHandler.bind(this));
  $(this.canvasID).on('mouseleave', mouseLeaveHandler.bind(this));

  this.mouseDownHandler = mouseDownHandler.bind(this);
  this.mouseMoveHandler = mouseMoveHandler.bind(this);
  this.mouseUpHandler = mouseUpHandler.bind(this);
  this.canvasClickHandler = canvasClickHandler.bind(this);

  $('.toolButton').click(toolButtonHandler.bind(this));
  // PhaiCity: a button with choices (src/toolLevels.ts) may change the tool it uses while in hand
  document.addEventListener('phaicity:toolchoice', function(e) {
    var button = $('.toolButton.selected');
    if (this.currentTool === null || button.length === 0)
      return;
    this.toolName = e.detail;
    this.currentTool = this.gameTools[this.toolName];
  }.bind(this));
  $('#budgetRequest').click(budgetHandler.bind(this));
  $('#evalRequest').click(evalHandler.bind(this));
  $('#mapRequest').click(mapHandler.bind(this));
  $('#disasterRequest').click(disasterHandler.bind(this));
  $('#pauseRequest').click(this.speedChangeHandler.bind(this));
  $('#screenshotRequest').click(screenshotHandler.bind(this));
  $('#settingsRequest').click(settingsHandler.bind(this));
  $('#saveRequest').click(saveHandler.bind(this));
  $('#debugRequest').click(debugHandler.bind(this));
});


var canvasID = '#' + GameCanvas.DEFAULT_ID;
var toolOutputID = '#toolOutput';


var keyDownHandler = function(e) {
  var handled = false;

  switch (e.keyCode) {
    case 38:
    case 87:
      this.up = true;
      handled = true;
      break;

    case 40:
    case 83:
      this.down = true;
      handled = true;
      break;

    case 39:
    case 68:
      this.right = true;
      handled = true;
      break;

    case 37:
    case 65:
      this.left = true;
      handled = true;
      break;

    case 27:
      this.escape = true;
      handled = true;
  }

  if (handled)
    e.preventDefault();
};


var keyUpHandler = function(e) {
  switch (e.keyCode) {
    case 38:
    case 87:
      this.up = false;
      break;

    case 40:
    case 83:
      this.down = false;
      break;

    case 39:
    case 68:
      this.right = false;
      break;

    case 37:
    case 65:
      this.left = false;
      break;

    case 27:
      this.escape = false;
  }
};


var getRelativeCoordinates = function(e) {
  var cRect = document.querySelector(this.canvasID).getBoundingClientRect();
  return {x: e.clientX - cRect.left, y: e.clientY - cRect.top};
};


var mouseEnterHandler = function(e) {
  // Listen whatever the tool, and let each handler check the tool when its event arrives: a tool picked from the
  // keyboard while the mouse is already over the map must work on the first click
  $(this.canvasID).off('mousemove mousedown click');
  $(this.canvasID).on('mousemove', this.mouseMoveHandler);
  $(this.canvasID).on('mousedown', this.mouseDownHandler);
  $(this.canvasID).on('click', this.canvasClickHandler);
};


// PhaiCity: zones are laid by dragging a rectangle; the game fills it with zones when the mouse is released
var AREA_TOOLS = ['residential', 'commercial', 'industrial'];


InputStatus.prototype.isAreaTool = function() {
  return this.currentTool !== null && AREA_TOOLS.indexOf(this.toolName) !== -1;
};


var mouseDownHandler = function(e) {
  var area = this.isAreaTool();
  if (this.currentTool === null || !(this.currentTool.isDraggable || area) ||
      e.which !== 1 || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)
    return;

  var coords = this.getRelativeCoordinates(e);
  this.mouseX = coords.x;
  this.mouseY = coords.y;

  // Every press of the mouse is one stroke: what it builds is undone together (src/undoHistory.ts)
  this.stroke += 1;
  this._dragging = true;
  if (area)
    this.areaDrag = {from: {x: coords.x, y: coords.y}, to: {x: coords.x, y: coords.y}};
  else
    this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY, stroke: this.stroke});

  this._lastDragX = Math.floor(this.mouseX / this._tileWidth);
  this._lastDragY = Math.floor(this.mouseY / this._tileWidth);

  $(this.canvasID).on('mouseup', this.mouseUpHandler);
  e.preventDefault();
};


var mouseUpHandler = function(e) {
  this._dragging = false;
  this._lastDragX = -1;
  this._lastDragY = -1;
  $(this.canvasID).off('mouseup');

  // Releasing the mouse lays the dragged area of zones
  if (this.areaDrag !== null) {
    var area = this.areaDrag;
    this.areaDrag = null;
    this._emitEvent(Messages.TOOL_AREA, {from: area.from, to: area.to, stroke: this.stroke});
  }
  e.preventDefault();
};


var mouseLeaveHandler = function(e) {
  $(this.canvasID).off('mousedown');
  $(this.canvasID).off('mousemove');
  $(this.canvasID).off('mouseup');

  // Watch out: we might have been mid-drag. An area not yet released is dropped.
  if (this._dragging) {
    this._dragging = false;
    this._lastDragX = -1;
    this._lastDragY = -1;
  }
  this.areaDrag = null;

  $(this.canvasID).off('click');

  this.mouseX = -1;
  this.mouseY = -1;
};


var mouseMoveHandler = function(e) {
  var coords = this.getRelativeCoordinates(e);
  this.mouseX = coords.x;
  this.mouseY = coords.y;

  if (this.areaDrag !== null) {
    this.areaDrag.to = {x: coords.x, y: coords.y};
    return;
  }

  if (this._dragging) {
    // XXX Work up how to patch up the path for fast mouse moves. My first attempt was too slow, and ended up missing
    // mouseUp events
    var x = Math.floor(this.mouseX / this._tileWidth);
    var y = Math.floor(this.mouseY / this._tileWidth);

    var lastX = this._lastDragX;
    var lastY = this._lastDragY;
    if (x !== lastX || y !== lastY) {
      this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY, stroke: this.stroke});
      this._lastDragX = x;
      this._lastDragY = y;
    }
  }
};


var canvasClickHandler = function(e) {
  if (this.currentTool === null || this.currentTool.isDraggable || this.isAreaTool() ||
      e.which !== 1 || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || this.mouseX === -1 ||
      this.mouseY === -1 || this._dragging)
    return;

  this.stroke += 1;
  this._emitEvent(Messages.TOOL_CLICKED, {x: this.mouseX, y: this.mouseY, stroke: this.stroke});
  e.preventDefault();
};


var toolButtonHandler = function(e) {
  // The button itself: a click may land on its icon or its name inside
  var button = $(e.currentTarget);

  // The tool the button uses: its own, or the one chosen for it above the tools (PhaiCity, src/toolLevels.ts)
  var toolName = button.attr('data-active-tool') || button.attr('data-tool');

  // Pressing the tool in hand again (or its number key) puts it down, as Esc does
  if (this.currentTool !== null && toolName === this.toolName) {
    this.clearTool();
    e.preventDefault();
    return;
  }

  // Remove highlight from last tool button
  $('.selected').each(function() {
    $(this).removeClass('selected');
    $(this).addClass('unselected');
  });

  // Add highlight
  button.removeClass('unselected');
  button.addClass('selected');

  this.toolName = toolName;
  this.toolWidth = button.attr('data-size');
  this.currentTool = this.gameTools[this.toolName];
  this.toolColour = button.attr('data-colour');
  // While a tool is in hand, the panel's title says how to put it down
  $(toolOutputID).text(t('tool.put_down'));

  if (this.toolName !== 'query') {
    $(this.canvasID).removeClass('helpPointer');
    $(this.canvasID).addClass('pointer');
  } else {
    $(this.canvasID).removeClass('pointer');
    $(this.canvasID).addClass('helpPointer');
  }

  e.preventDefault();
};


InputStatus.prototype.speedChangeHandler = function(e) {
  // The button's paused class, not its translated name, records whether it currently offers Pause or Resume;
  // its name sits in the label that slides out of the icon (src/menuRail.ts)
  var button = $('#pauseRequest');
  var requestedSpeed = button.hasClass('paused') ? 'Play' : 'Pause';
  var newKey = requestedSpeed === 'Pause' ? 'menu.play' : 'menu.pause';
  button.toggleClass('paused', requestedSpeed === 'Pause');
  button.find('.railLabel > span').attr('data-i18n', newKey).text(t(newKey));
  button.attr('aria-label', t(newKey));
  this._emitEvent(Messages.SPEED_CHANGE, requestedSpeed);
};


InputStatus.prototype.clearTool = function() {
  if (this.toolName === 'query') {
    $(this.canvasID).removeClass('helpPointer');
    $(this.canvasID).addClass('pointer');
  }

  // Forget the name too, or a click after Escape would still use the old tool
  this.toolName = null;
  this.areaDrag = null;
  this.currentTool = null;
  this.toolWidth = 0;
  this.toolColour = '';
  $('.selected').removeClass('selected').addClass('unselected');
  $(toolOutputID).text(t('tool.header'));
};


var makeHandler = function(message) {
  var m = Messages[message];

  return function(e) {
    this._emitEvent(m);
  };
};


var budgetHandler = makeHandler('BUDGET_REQUESTED');
var debugHandler = makeHandler('DEBUG_WINDOW_REQUESTED');
var disasterHandler = makeHandler('DISASTER_REQUESTED');
var evalHandler = makeHandler('EVAL_REQUESTED');
var mapHandler = makeHandler('MAP_REQUESTED');
var screenshotHandler = makeHandler('SCREENSHOT_WINDOW_REQUESTED');
var settingsHandler = makeHandler('SETTINGS_WINDOW_REQUESTED');
var saveHandler = makeHandler('SAVE_REQUESTED');


export { InputStatus };
