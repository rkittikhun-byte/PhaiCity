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

import { MiscUtils } from './miscUtils.js';
import { graphsOfOldSave } from './roads/roadMigration.ts';

// A very thin wrapper around localStorage, in case we wish to move to some other storage mechanism
// (such as indexedDB) in the future

var getSavedGame = function() {
  var savedGame = window.localStorage.getItem(this.KEY);

  if (savedGame !== null) {
    savedGame = JSON.parse(savedGame);

    if (savedGame.version !== this.CURRENT_VERSION)
      this.transitionOldSave(savedGame);

    // Flag as a saved game for Game/Simulation etc...
    savedGame.isSavedGame = true;
  }

  return savedGame;
};


var saveGame = function(gameData) {
  gameData.version = this.CURRENT_VERSION;
  gameData = JSON.stringify(gameData);

  window.localStorage.setItem(this.KEY, gameData);
};


var transitionOldSave = function(savedGame) {
  switch (savedGame.version) {
    case 1:
      savedGame.everClicked = false;

      /* falls through */
    case 2:
      savedGame.pollutionMaxX = Math.floor(savedGame.width / 2);
      savedGame.pollutionMaxY = Math.floor(savedGame.height / 2);
      savedGame.cityCentreX = Math.floor(savedGame.width / 2);
      savedGame.cityCentreY = Math.floor(savedGame.height / 2);

      /* falls through */
    case 3:
      // Version 4 records the province and online world of a city; older saves were offline random maps
      savedGame.provinceId = null;
      savedGame.worldId = null;

      /* falls through */
    case 4:
      // PhaiCity: version 5 keeps the roads and railways as drawn, in metres (src/roads/roadGraph.ts); an older city's
      // are worked out once from the lines its roads were drawn as (docs/METRE_DRAWING_PLAN.md 1.6)
      Object.assign(savedGame, graphsOfOldSave(savedGame));

      break;

    default:
      throw new Error('Unknown save version!');
  }
};


var Storage = {
  getSavedGame: getSavedGame,
  saveGame: saveGame,
  transitionOldSave: transitionOldSave
};


Object.defineProperty(Storage, 'CURRENT_VERSION', MiscUtils.makeConstantDescriptor(5));
Object.defineProperty(Storage, 'KEY', MiscUtils.makeConstantDescriptor('micropolisJSGame'));
// Checked safely, so the save helpers also load in Node (tests, a future server)
Object.defineProperty(Storage, 'canStore', MiscUtils.makeConstantDescriptor(
  typeof window !== 'undefined' && window.localStorage !== undefined));


export { Storage };
