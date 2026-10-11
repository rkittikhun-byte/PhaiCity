/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import $ from "jquery";

import { t } from './i18n/index.ts';
import { MAIN_MENU_WINDOW_CLOSED } from './messages.ts';
import { ModalWindow } from './modalWindow.js';

// Asks whether to save the city before going back to the start screen. Closing emits
// MAIN_MENU_WINDOW_CLOSED with the player's choice: 'save', 'quit' or 'stay'.
var MainMenuWindow = ModalWindow(function() {
  $(formID).on('submit', choose.bind(this, 'stay'));
  $(saveID).on('click', choose.bind(this, 'save'));
  $(quitID).on('click', choose.bind(this, 'quit'));
});


var formID = '#mainMenuForm';
var saveID = '#mainMenuSave';
var quitID = '#mainMenuQuit';
var stayID = '#mainMenuStay';


var choose = function(choice, e) {
  e.preventDefault();
  this.close(choice);
};


MainMenuWindow.prototype.close = function(choice) {
  this._toggleDisplay();
  this._emitEvent(MAIN_MENU_WINDOW_CLOSED, choice);
};


MainMenuWindow.prototype.open = function(cityName, canSave) {
  $('#mainMenuQuestion').text(t('mainmenu.question', {city: cityName}));
  $(saveID).prop('disabled', !canSave);
  this._toggleDisplay();
  $(canSave ? saveID : stayID).focus();
};


export { MainMenuWindow };
