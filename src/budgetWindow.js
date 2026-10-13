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

import { formatMoney, t } from './i18n/index.ts';
import { BUDGET_WINDOW_CLOSED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { ModalWindow } from './modalWindow.js';

var BudgetWindow = ModalWindow(function() {
  $(budgetCancelID).on('click', cancel.bind(this));
  $(budgetResetID).on('click', resetItems.bind(this));
  $(budgetFormID).on('submit', submit.bind(this));
});


var dataKeys = ['roadMaintenanceBudget', 'fireMaintenanceBudget', 'policeMaintenanceBudget'];
var spendKeys = ['roadRate', 'fireRate', 'policeRate'];

var budgetResetID = '#budgetReset';
var budgetCancelID = '#budgetCancel';
var budgetFormID = '#budgetForm';
var budgetOKID = '#budgetOK';


var setSpendRangeText = function(element, percentage, totalSpend) {
  var labelID = element + 'Label';
  var cash = Math.floor(totalSpend * (percentage / 100));
  var text = t('budget.rate_label', {pct: percentage, total: totalSpend, spent: cash});
  $(MiscUtils.normaliseDOMid(labelID)).text(text);
};


var onFundingUpdate = function(elementID, e) {
  var element = $(MiscUtils.normaliseDOMid(elementID))[0];
  var percentage = element.value - 0;
  var dataSource = element.getAttribute('data-source');
  setSpendRangeText(elementID, percentage, this[dataSource]);
};


var onTaxUpdate = function(e) {
  var elem = $('#taxRateLabel')[0];
  var sourceElem = $('#taxRate')[0];
  $(elem).text(t('budget.tax_label', {pct: sourceElem.value}));
};


var resetItems = function(e) {
  for (var i = 0; i < spendKeys.length; i++) {
    var original = this['original' + spendKeys[i]];
    $(MiscUtils.normaliseDOMid(spendKeys[i]))[0].value = original;
    setSpendRangeText(spendKeys[i], original, this[dataKeys[i]]);
  }
  $('#taxRate')[0].value = this.originaltaxRate;
  onTaxUpdate();

  e.preventDefault();
};


BudgetWindow.prototype.close = function(data) {
  data = data || {cancelled: true};
  this._emitEvent(BUDGET_WINDOW_CLOSED, data);
  this._toggleDisplay();
};


var cancel = function(e) {
  e.preventDefault();
  this.close({cancelled: true});
};


var submit = function(e) {
  e.preventDefault();

  // Get element values
  var roadPercent = $('#roadRate')[0].value;
  var firePercent = $('#fireRate')[0].value;
  var policePercent = $('#policeRate')[0].value;
  var taxPercent = $('#taxRate')[0].value;

  var data = {cancelled: false, roadPercent: roadPercent, firePercent: firePercent,
                        policePercent: policePercent, taxPercent: taxPercent, e: e, original: e.type};
  this.close(data);
};


BudgetWindow.prototype.open = function(budgetData) {
  var i, elem;

  // Store max funding levels
  for (i = 0; i < dataKeys.length; i++) {
    if (budgetData[dataKeys[i]] === undefined)
      throw new Error('Missing budget data ('  + dataKeys[i] + ')');
    this[dataKeys[i]] = budgetData[dataKeys[i]];
  }

  // Update form elements with percentages, and set up listeners
  for (i = 0; i < spendKeys.length; i++) {
    if (budgetData[spendKeys[i]] === undefined)
      throw new Error('Missing budget data (' + spendKeys[i] + ')');

    elem = spendKeys[i];
    this['original' + elem] = budgetData[elem];
    setSpendRangeText(elem, budgetData[spendKeys[i]], this[dataKeys[i]]);
    elem = $(MiscUtils.normaliseDOMid(elem));
    elem.on('change', onFundingUpdate.bind(this, spendKeys[i]));
    elem = elem[0];
    elem.value = budgetData[spendKeys[i]];
  }

  if (budgetData.taxRate === undefined)
    throw new Error('Missing budget data (taxRate)');

  this.originalTaxRate = budgetData.taxRate;
  elem = $('#taxRate');
  elem.on('change', onTaxUpdate);
  elem = elem[0];
  elem.value = budgetData.taxRate;
  onTaxUpdate();

  // Update static parts
  var previousFunds = budgetData.totalFunds;
  if (previousFunds === undefined)
    throw new Error('Missing budget data (previousFunds)');

  var taxesCollected = budgetData.taxesCollected;
  if (taxesCollected === undefined)
    throw new Error('Missing budget data (taxesCollected)');

  var cashFlow = taxesCollected - this.roadMaintenanceBudget - this.fireMaintenanceBudget - this.policeMaintenanceBudget;
  var currentFunds = previousFunds + cashFlow;
  // PhaiCity: what visitors spent is paid in with the taxes (src/tourism.ts); shown apart, and only where there is some
  var tourismIncome = budgetData.tourismIncome || 0;
  // ... and what the power plants' fuel cost is taken from them (src/powerPlants.ts)
  var fuelCost = budgetData.fuelCost || 0;
  // ... and the mines' royalties are paid in with them too (src/mining.ts)
  var miningIncome = budgetData.miningIncome || 0;
  // ... and the farms' and fishing harbours' sales (src/farming.ts)
  var farmIncome = budgetData.farmIncome || 0;
  // ... and the tollways' tolls (src/roadLevels.ts)
  var tollIncome = budgetData.tollIncome || 0;
  $('#taxesCollected').text(formatMoney(taxesCollected - tourismIncome - miningIncome - farmIncome - tollIncome +
                                        fuelCost));
  $('#tollIncome').text(formatMoney(tollIncome));
  $('#tollInfo').prop('hidden', tollIncome <= 0);
  $('#farmIncome').text(formatMoney(farmIncome));
  $('#farmInfo').prop('hidden', farmIncome <= 0);
  $('#miningIncome').text(formatMoney(miningIncome));
  $('#miningInfo').prop('hidden', miningIncome <= 0);
  $('#fuelCost').text(formatMoney(fuelCost));
  $('#fuelInfo').prop('hidden', fuelCost <= 0);
  $('#tourismIncome').text(formatMoney(tourismIncome));
  $('#tourismInfo').prop('hidden', tourismIncome <= 0);
  $('#cashFlow').text(formatMoney(cashFlow));
  $('#previousFunds').text(formatMoney(previousFunds));
  $('#currentFunds').text(formatMoney(currentFunds));

  this._toggleDisplay();
};


export { BudgetWindow };
