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


// The taxes and fees (PhaiCity, src/budget.js): the homes' tax (the original one), the shops' and the factories', the
// water fee and the visitors' fee; each slider, its value in the budget data, and its label
var rateKeys = [
  {id: 'taxRate', data: 'taxRate', label: 'budget.tax_label'},
  {id: 'comTaxRate', data: 'comTax', label: 'budget.tax_label'},
  {id: 'indTaxRate', data: 'indTax', label: 'budget.tax_label'},
  {id: 'waterFeeRate', data: 'waterFee', label: 'budget.water_fee_label'},
  {id: 'touristFeeRate', data: 'touristFee', label: 'budget.tourist_fee_label'}
];


var onTaxUpdate = function(e) {
  rateKeys.forEach(function(rate) {
    var sourceElem = $('#' + rate.id)[0];
    if (sourceElem)
      $('#' + rate.id + 'Label').text(t(rate.label, {pct: sourceElem.value}));
  });
};


var resetItems = function(e) {
  for (var i = 0; i < spendKeys.length; i++) {
    var original = this['original' + spendKeys[i]];
    $(MiscUtils.normaliseDOMid(spendKeys[i]))[0].value = original;
    setSpendRangeText(spendKeys[i], original, this[dataKeys[i]]);
  }
  rateKeys.forEach(function(rate) {
    var original = this['original' + rate.id];
    if (original !== undefined)
      $('#' + rate.id)[0].value = original;
  }, this);
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
                        policePercent: policePercent, taxPercent: taxPercent, e: e, original: e.type,
                        comTax: $('#comTaxRate')[0].value, indTax: $('#indTaxRate')[0].value,
                        waterFee: $('#waterFeeRate')[0].value, touristFee: $('#touristFeeRate')[0].value};
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
  // Every tax and fee slider (the shops' and factories' taxes start from the homes' in a budget from before them)
  rateKeys.forEach(function(rate) {
    var value = budgetData[rate.data];
    if (value === undefined)
      value = rate.data === 'comTax' || rate.data === 'indTax' ? budgetData.taxRate : 0;
    this['original' + rate.id] = value;
    elem = $('#' + rate.id);
    elem.off('input change', onTaxUpdate).on('input change', onTaxUpdate);
    elem[0].value = value;
  }, this);
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
  // ... and what the ruler's house and its wings cost is taken from them (src/rulerHouse.ts)
  var houseCost = budgetData.houseCost || 0;
  // ... and the water fees are paid in with them (src/budget.js)
  var waterIncome = budgetData.waterIncome || 0;
  // ... and the schools and hospitals cost is taken from them (src/services.ts)
  var educationCost = budgetData.educationCost || 0;
  var healthCost = budgetData.healthCost || 0;
  // ... and the rubbish and wastewater buildings cost is taken from them, and what recycling sold paid in (src/waste.ts)
  var wasteCost = budgetData.wasteCost || 0;
  var recyclingIncome = budgetData.recyclingIncome || 0;
  // ... and the ruler's policies cost is taken from them, and the pollution tax paid in (src/policies.ts)
  var policyCost = budgetData.policyCost || 0;
  var pollutionTaxIncome = budgetData.pollutionTaxIncome || 0;
  // ... and public transport's upkeep is taken from them (src/transit.ts)
  var transitCost = budgetData.transitCost || 0;
  $('#taxesCollected').text(formatMoney(taxesCollected - tourismIncome - miningIncome - farmIncome - tollIncome -
                                        waterIncome - recyclingIncome - pollutionTaxIncome + fuelCost + houseCost +
                                        educationCost + healthCost + wasteCost + policyCost + transitCost));
  $('#transitCost').text(formatMoney(transitCost));
  $('#transitInfo').prop('hidden', transitCost <= 0);
  $('#policyCost').text(formatMoney(policyCost));
  $('#policyInfo').prop('hidden', policyCost <= 0);
  $('#pollutionTaxIncome').text(formatMoney(pollutionTaxIncome));
  $('#pollutionTaxInfo').prop('hidden', pollutionTaxIncome <= 0);
  $('#wasteCost').text(formatMoney(wasteCost));
  $('#wasteInfo').prop('hidden', wasteCost <= 0);
  $('#recyclingIncome').text(formatMoney(recyclingIncome));
  $('#recyclingInfo').prop('hidden', recyclingIncome <= 0);
  $('#educationCost').text(formatMoney(educationCost));
  $('#educationInfo').prop('hidden', educationCost <= 0);
  $('#healthCost').text(formatMoney(healthCost));
  $('#healthInfo').prop('hidden', healthCost <= 0);
  $('#waterIncome').text(formatMoney(waterIncome));
  $('#waterInfo').prop('hidden', waterIncome <= 0);
  $('#houseCost').text(formatMoney(houseCost));
  $('#houseInfo').prop('hidden', houseCost <= 0);
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
