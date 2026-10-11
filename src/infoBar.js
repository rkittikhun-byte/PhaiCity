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

import { formatYear, onLanguageChange, t } from './i18n/index.ts';
import * as Messages from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { Text } from './text.js';

var InfoBar = function(classification, population, score, funds, date, name) {
  var classificationSelector = MiscUtils.normaliseDOMid(classification);
  var populationSelector = MiscUtils.normaliseDOMid(population);
  var scoreSelector = MiscUtils.normaliseDOMid(score);
  var fundsSelector = MiscUtils.normaliseDOMid(funds);
  var dateSelector = MiscUtils.normaliseDOMid(date);
  var nameSelector = MiscUtils.normaliseDOMid(name);

  return function(dataSource, initialValues) {
    // The city class and date are words in the player's language, so keep the values to redraw them after a switch
    var currentClass = initialValues.classification;
    var currentDate = initialValues.date;

    var showClassification = function() {
      $(classificationSelector).text(Text.cityClass[currentClass]);
    };

    var showDate = function() {
      $(dateSelector).text(t('infobar.date', {month: Text.months[currentDate.month], year: formatYear(currentDate.year)}));
    };

    showClassification();
    $(populationSelector).text(initialValues.population);
    $(scoreSelector).text(initialValues.score);
    $(fundsSelector).text(initialValues.funds);
    showDate();
    $(nameSelector).text(initialValues.name);

    onLanguageChange(function() {
      showClassification();
      showDate();
    });

    // Add the various listeners
    dataSource.addEventListener(Messages.CLASSIFICATION_UPDATED, function(classification) {
      currentClass = classification;
      showClassification();
    });

    dataSource.addEventListener(Messages.POPULATION_UPDATED, function(population) {
      $(populationSelector).text(population);
    });

    dataSource.addEventListener(Messages.SCORE_UPDATED, function(score) {
      $(scoreSelector).text(score);
    });

    dataSource.addEventListener(Messages.FUNDS_CHANGED, function(funds) {
      $(fundsSelector).text(funds);
    });

    dataSource.addEventListener(Messages.DATE_UPDATED, function(date) {
      currentDate = date;
      showDate();
    });
  };
};


export { InfoBar };
