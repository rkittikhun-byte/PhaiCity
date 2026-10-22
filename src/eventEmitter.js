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

import { Config } from './config.js';

// Decorate the given object, by adding {add|remove}EventListener methods, and an internal '_emitEvent' method
// PhaiCity: each object keeps its own listeners (docs/NO_GRID_PLAN.md 0.3). The original kept one list for every object
// a decorated constructor made, so every city's simulation in one page or process heard every other's months (a new
// city's month ran an old city's monthly systems too, drawing from the one Random, so the same seed and commands did not
// make the same city twice), and each sprite heard every other sprite's crashes.
var EventEmitter = function(obj) {
  var shared = {};

  // The listeners of the object a method is called on (the shared list only for a call on no object)
  var eventsOf = function(self) {
    if (self === undefined || self === null || self === globalThis)
      return shared;
    if (!Object.prototype.hasOwnProperty.call(self, '_eventListeners'))
      Object.defineProperty(self, '_eventListeners', {value: {}, writable: true, configurable: true});
    return self._eventListeners;
  };


  var addListener = function(event, listener) {
    var events = eventsOf(this);
    if (!(event in events))
      events[event] = [];

    var listeners = events[event];
    if (listeners.indexOf(listener) === -1)
      listeners.push(listener);
  };


  var removeListener = function(event, listener) {
    var events = eventsOf(this);
    if (!(event in events))
      events[event] = [];

    var listeners = events[event];
    var index = listeners.indexOf(listener);
    if (index !== -1)
      listeners.splice(index, 1);
  };


  var emitEvent = function(event, value) {
    if (event === undefined) {
      if (!Config.debug)
        console.warn('Sending undefined event!');
      else
        throw new Error('Sending undefined event!');
    }

    var events = eventsOf(this);
    if (!(event in events))
      events[event] = [];

    var listeners = events[event];
    for (var i = 0, l = listeners.length; i < l; i++)
      listeners[i](value);
  };


  var addProps = function(obj, message) {
    var hasExistingProp = ['addEventListener', 'removeEventListener', '_emitEvent'].some(function(prop) {
      return obj[prop] !== undefined;
    });

    if (hasExistingProp)
      throw new Error('Cannot decorate ' + message + ': existing properties would be overwritten!');

    obj.addEventListener = addListener;
    obj.removeEventListener = removeListener;
    obj._emitEvent = emitEvent;
  };

  if (typeof(obj) === 'object')
    addProps(obj, 'object');
  else
    addProps(obj.prototype, 'constructor');

  return obj;
};


export { EventEmitter };
