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

import { onLanguageChange } from './i18n/index.ts';
import { MiscUtils } from './miscUtils.js';
import { hide, show } from './motion.ts';
import { Text } from './text.js';

// PhaiCity: news shows at the top of the screen for a few seconds and fades (owner, 12 Oct 2026); every item stays
// in the recent news (src/newsLog.ts)
var TIMEOUT_SECS = 7;


// log: optional recent-news log (src/newsLog.ts) that keeps every item shown here
function Notification(element, map, initialText, log) {
  element = MiscUtils.normaliseDOMid(element);

  this._map = map;
  this._log = log || null;
  this._element = $(element);
  this._timeout = null;
  // The message on show, kept so a language switch can redraw it
  this._subject = null;

  this._handleClick = handleClick.bind(this);

  // The position to centre on when the link is clicked
  this._x = -1;
  this._y = -1;

  this._element.click(this._handleClick);
  this.close = close.bind(this);
  if (this._element.is(':visible'))
    this._element.toggle();

  onLanguageChange(function() {
    if (this._subject !== null)
      this._element.text(Text.messageText[this._subject]);
  }.bind(this));
}


var close = function(e) {
  if (e)
    e.preventDefault();

  if (this._element.is(':visible'))
    hide(this._element[0]);
};


Notification.prototype._displayLink = function(text, x, y) {
  if (this._timeout !== null) {
    window.clearTimeout(this._timeout);
    this._timeout = null;
  }

  this._element.text(text);

  this._x = x;
  this._y = y;

  this._element.addClass('pointer');

  show(this._element[0], 'block');

  this._timeout = window.setTimeout(function() {this._timeout = null; this.close();}.bind(this), TIMEOUT_SECS * 1000);
};


Notification.prototype._displayText = function(text, x, y) {
  if (this._timeout !== null) {
    window.clearTimeout(this._timeout);
    this._timeout = null;
  }

  this._element.removeClass('pointer');
  this._element.text(text);
  this._x = -1;
  this._y = -1;

  show(this._element[0], 'block');

  this._timeout = window.setTimeout(function() {this._timeout = null; this.close();}.bind(this), TIMEOUT_SECS * 1000);
};


var handleClick = function(e) {
  e.preventDefault();

  if (this._x === -1 || this._y === -1)
    return;

  this._map.centreOn(this._x, this._y);
};


// unlogged: true for a message that does not belong in the recent news, such as the greeting
Notification.prototype.createMessage = function(message, kind, unlogged) {
  var hasPlace = message.hasOwnProperty('data') && message.data !== undefined && message.data.hasOwnProperty('x') &&
                 message.data.hasOwnProperty('y');

  this._subject = message.subject;

  if (this._log !== null && !unlogged)
    this._log.add(kind || 'neutral', message.subject, hasPlace ? message.data.x : undefined, hasPlace ? message.data.y : undefined);

  if (hasPlace) {
    this._displayLink(Text.messageText[message.subject], message.data.x, message.data.y);
    return;
  }

  this._displayText(Text.messageText[message.subject]);
};


Notification.prototype.badNews = function(message) {
  this._element.removeClass('neutral');
  this._element.removeClass('good');
  this._element.addClass('bad');
  this.createMessage(message, 'bad');
};


Notification.prototype.goodNews = function(message) {
  this._element.removeClass('neutral');
  this._element.removeClass('bad');
  this._element.addClass('good');
  this.createMessage(message, 'good');
};


Notification.prototype.news = function(message, unlogged) {
  this._element.removeClass('good');
  this._element.removeClass('bad');
  this._element.addClass('neutral');
  this.createMessage(message, 'neutral', unlogged);
};


// Good news written by the game itself rather than a simulation message (the era score, src/eraScore.ts)
Notification.prototype.goodText = function(text) {
  this._element.removeClass('neutral');
  this._element.removeClass('bad');
  this._element.addClass('good');
  this._displayText(text);
};


// ... and bad news of its own (a festival's fire, src/festivalCard.ts), with where it happened when it knows
Notification.prototype.badText = function(text, x, y) {
  this._element.removeClass('neutral');
  this._element.removeClass('good');
  this._element.addClass('bad');
  if (x !== undefined && y !== undefined)
    this._displayLink(text, x, y);
  else
    this._displayText(text);
};


export { Notification };
