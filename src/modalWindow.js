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
import { MiscUtils } from './miscUtils.js';
import { hide, isShown, show } from './motion.ts';
import { placeWindow, trackPresses } from './windowPlacement.ts';

trackPresses();

// Clicking outside the open window closes it, as its Cancel button would (or OK, when it has none)
$(document).on('click', '#opaque', function() {
  var open = $('.modal:visible').not('.motionLeave').last();
  if (open.length === 0)
    return;

  var cancel = open.find('.cancel:visible').first();
  if (cancel.length > 0)
    cancel.trigger('click');
  else
    open.find('input[type=submit]:visible').first().trigger('click');
});


var ModalWindow = function(constructorFunction, focusID) {
  focusID = focusID ? MiscUtils.normaliseDOMid(focusID) : null;

  var newConstructor = function(opacityLayerID, windowID) {
    this._opacityLayer =  MiscUtils.normaliseDOMid(opacityLayerID);
    this._windowID = MiscUtils.normaliseDOMid(windowID);
    constructorFunction.call(this);
  };


  newConstructor.prototype._toggleDisplay = function() {
    var opacityLayer = $(this._opacityLayer);
    opacityLayer = opacityLayer.length === 0 ? null : opacityLayer;
    if (opacityLayer === null)
      throw new Error('Node ' + this._opacityLayer + ' not found');

    var modalWindow = $(this._windowID);
    modalWindow = modalWindow.length === 0 ? null : modalWindow;
    if (modalWindow === null)
      throw new Error('Node ' + this._windowID + ' not found');

    // Open or close with an animation (src/motion.ts) rather than an instant toggle
    if (isShown(modalWindow[0])) {
      hide(modalWindow[0]);
      hide(opacityLayer[0]);
      return;
    }

    show(opacityLayer[0], 'block');
    show(modalWindow[0], 'block');
    // Beside the card that opened it (src/windowPlacement.ts)
    placeWindow(modalWindow[0]);

    if (focusID !== null)
      $(focusID).focus();
    else
      $(this._windowID + ' input[type=submit]').focus();
  };


  return EventEmitter(newConstructor);
};


export { ModalWindow };
