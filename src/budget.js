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

import { EventEmitter } from './eventEmitter.js';
import * as Messages from './messages.ts';
import { MiscUtils } from './miscUtils.js';

// Cost of maintaining 1 police station
var policeMaintenanceCost = 100;

// Cost of maintaining 1 fire station
var fireMaintenanceCost = 100;

// Cost of maintaining 1 road tile
var roadMaintenanceCost = 1;

// Cost of maintaining 1 rail tile
var railMaintenanceCost = 2;

// PhaiCity (owner, 15 Oct 2026: "แก้เรื่องเงินก่อน หาว่ารายจ่ายไหนทำให้เมืองขาดทุนทุกปี แล้วปรับให้สมดุล"): what the taxes
// bring, six times the original game's. A town here also pays for its power plants' fuel, its schools, its hospitals,
// the ruler's house and its rubbish, which the original never charged; at the original's taxes a sensibly built town
// of 2,000 to 6,000 people lost ฿300–700 a year (src/core/autoPlayer.ts, test/play/khonKaen.ts)
var TAX_YIELD = 6;


var Budget = EventEmitter(function() {
  Object.defineProperties(this,
   {MAX_ROAD_EFFECT: MiscUtils.makeConstantDescriptor(32),
    MAX_POLICESTATION_EFFECT: MiscUtils.makeConstantDescriptor(1000),
    MAX_FIRESTATION_EFFECT:  MiscUtils.makeConstantDescriptor(1000)});

  this.roadEffect = this.MAX_ROAD_EFFECT;
  this.policeEffect = this.MAX_POLICESTATION_EFFECT;
  this.fireEffect = this.MAX_FIRESTATION_EFFECT;
  this.totalFunds = 0;
  this.cityTax = 7;
  this.cashFlow = 0;
  this.taxFund = 0;
  // PhaiCity (src/tourism.ts): what visitors spend through the year, paid in with the taxes, and last year's
  this.tourismFund = 0;
  this.tourismIncome = 0;
  // PhaiCity (src/powerPlants.ts): what the power plants' fuel cost last year
  this.fuelCost = 0;
  // PhaiCity (src/mining.ts): the mines' royalties through the year, paid in with the taxes, and last year's
  this.miningFund = 0;
  this.miningIncome = 0;
  // ... and the farms' and harbours' sales (src/farming.ts)
  this.farmFund = 0;
  this.farmIncome = 0;
  // ... and the tollways' tolls (src/roadLevels.ts)
  this.tollFund = 0;
  this.tollIncome = 0;
  // ... and what the ruler's house and its wings cost last year (src/rulerHouse.ts), and the treasury wing's share of
  // the taxes (0, or 0.05 while the house has it; the simulation sets it)
  this.houseCost = 0;
  this.taxBonus = 0;
  // ... and what the schools and the hospitals cost last year (src/services.ts)
  this.educationCost = 0;
  this.healthCost = 0;
  // ... and what recycling sells through the year, paid in with the taxes, and what the rubbish and wastewater
  // buildings cost last year (src/waste.ts)
  this.wasteFund = 0;
  this.recyclingIncome = 0;
  this.wasteCost = 0;
  // ... and what the ruler's policies cost last year, and the pollution tax they took (src/policies.ts); the simulation
  // sets the year's cost and the tax's rate before the taxes are collected
  this.policyCost = 0;
  this.pollutionTaxRate = 0;
  this.pollutionTaxIncome = 0;
  // ... and what public transport cost last year (src/transit.ts)
  this.transitCost = 0;
  // PhaiCity (owner, 13 Oct 2026): a tax for each kind of zone, cityTax staying the homes' (0–20%), and two fees: the
  // water fee, in baht a year for each zone the water reaches (0–10), and the visitors' fee, a percentage on what they
  // spend (0–20). Each brings money and costs something (src/valves.js, src/waterManager.ts, src/simulation.js)
  this.comTax = 7;
  this.indTax = 7;
  this.waterFee = 0;
  this.touristFee = 0;
  this.waterIncome = 0;

  // These values denote how much money is required to fully maintain the relevant services
  this.roadMaintenanceBudget = 0;
  this.fireMaintenanceBudget = 0;
  this.policeMaintenanceBudget = 0;

  // Percentage of budget used
  this.roadPercent = 1;
  this.firePercent = 1;
  this.policePercent = 1;

  // Cash value of spending. Should equal Math.round(_MaintenanceBudget * _Percent)
  this.roadSpend = 0;
  this.fireSpend = 0;
  this.policeSpend = 0;

  this.awaitingValues = false;
  this.autoBudget = true;
});


var saveProps = ['autoBudget', 'totalFunds', 'policePercent', 'roadPercent', 'firePercent', 'roadSpend',
                 'policeSpend', 'fireSpend', 'roadMaintenanceBudget', 'policeMaintenanceBudget',
                 'fireMaintenanceBudget', 'cityTax', 'roadEffect', 'policeEffect', 'fireEffect', 'tourismFund',
                 'tourismIncome', 'fuelCost', 'miningFund', 'miningIncome',
                 'farmFund', 'farmIncome', 'tollFund', 'tollIncome', 'houseCost', 'comTax', 'indTax', 'waterFee',
                 'touristFee', 'waterIncome', 'educationCost', 'healthCost', 'wasteFund', 'recyclingIncome',
                 'wasteCost', 'policyCost', 'pollutionTaxIncome', 'transitCost'];

Budget.prototype.save = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    saveData[saveProps[i]] = this[saveProps[i]];
};


Budget.prototype.load = function(saveData) {
  for (var i = 0, l = saveProps.length; i < l; i++)
    this[saveProps[i]] = saveData[saveProps[i]];
  // Saves from before tourism have none
  this.tourismFund = this.tourismFund || 0;
  this.tourismIncome = this.tourismIncome || 0;
  this.fuelCost = this.fuelCost || 0;
  this.miningFund = this.miningFund || 0;
  this.miningIncome = this.miningIncome || 0;
  this.farmFund = this.farmFund || 0;
  this.farmIncome = this.farmIncome || 0;
  this.tollFund = this.tollFund || 0;
  this.tollIncome = this.tollIncome || 0;
  this.houseCost = this.houseCost || 0;
  // Saves from before the separate taxes: shops and factories pay what homes paid, and there are no fees
  if (typeof this.comTax !== 'number')
    this.comTax = this.cityTax;
  if (typeof this.indTax !== 'number')
    this.indTax = this.cityTax;
  this.waterFee = this.waterFee || 0;
  this.touristFee = this.touristFee || 0;
  this.waterIncome = this.waterIncome || 0;
  this.educationCost = this.educationCost || 0;
  this.healthCost = this.healthCost || 0;
  this.wasteFund = this.wasteFund || 0;
  this.recyclingIncome = this.recyclingIncome || 0;
  this.wasteCost = this.wasteCost || 0;
  this.policyCost = this.policyCost || 0;
  this.pollutionTaxIncome = this.pollutionTaxIncome || 0;
  this.transitCost = this.transitCost || 0;

  this._emitEvent(Messages.AUTOBUDGET_CHANGED, this.autoBudget);
  this._emitEvent(Messages.FUNDS_CHANGED, this.totalFunds);
};


Budget.prototype.setAutoBudget = function(value) {
  this.autoBudget = value;
  this._emitEvent(Messages.AUTOBUDGET_CHANGED, this.autoBudget);
};


var RLevels = [0.7, 0.9, 1.2];
var FLevels = [1.4, 1.2, 0.8];

// Calculates the best possible outcome in terms of funding the various services
// given the player's current funds and tax yield. On entry, roadPercent etc. are
// assumed to contain the desired percentage level, and taxFunds should contain the
// most recent tax collected. On exit, the *Percent members will be updated with what
// we can actually afford to spend. Returns an object containing the amount of cash
// that would be spent on each service.
Budget.prototype._calculateBestPercentages = function() {
  // How much would we be spending based on current percentages?
  // Note: the *Budget items are updated every January by collectTax
  this.roadSpend = Math.round(this.roadMaintenanceBudget * this.roadPercent);
  this.fireSpend = Math.round(this.fireMaintenanceBudget * this.firePercent);
  this.policeSpend = Math.round(this.policeMaintenanceBudget * this.policePercent);
  var total = this.roadSpend + this.fireSpend + this.policeSpend;

  // If we don't have any services on the map, we can bail early
  if (total === 0) {
    this.roadPercent = 1;
    this.firePercent = 1;
    this.policePercent = 1;
    return {road: 1, fire: 1, police: 1};
  }

  // How much are we actually going to spend?
  var roadCost = 0;
  var fireCost = 0;
  var policeCost = 0;

  var cashRemaining = this.totalFunds + this.taxFund;

  // Spending priorities: road, fire, police
  if (cashRemaining >= this.roadSpend)
    roadCost = this.roadSpend;
  else
    roadCost = cashRemaining;
  cashRemaining -= roadCost;

  if (cashRemaining >= this.fireSpend)
    fireCost = this.fireSpend;
  else
    fireCost = cashRemaining;
  cashRemaining -= fireCost;

  if (cashRemaining >= this.policeSpend)
    policeCost = this.policeSpend;
  else
    policeCost = cashRemaining;
  cashRemaining -= policeCost;

  if (this.roadMaintenanceBudget > 0)
    this.roadPercent = (roadCost / this.roadMaintenanceBudget).toPrecision(2) - 0;
  else
    this.roadPercent = 1;

  if (this.fireMaintenanceBudget > 0)
    this.firePercent = (fireCost / this.fireMaintenanceBudget).toPrecision(2) - 0;
  else
    this.firePercent = 1;

  if (this.policeMaintenanceBudget > 0)
    this.policePercent = (policeCost / this.policeMaintenanceBudget).toPrecision(2) - 0;
  else
    this.policePercent = 1;

  return {road: roadCost, police: policeCost, fire: fireCost};
};


// User initiated budget
Budget.prototype.doBudgetWindow = function() {
  return this.doBudgetNow(true);
};


Budget.prototype.doBudgetNow = function(fromWindow) {
  var costs = this._calculateBestPercentages();

  if (!this.autoBudget && !fromWindow) {
    this.autoBudget = false;
    this.awaitingValues = true;
    this._emitEvent(Messages.BUDGET_NEEDED);
    return;
  }

  var roadCost = costs.road;
  var policeCost = costs.police;
  var fireCost = costs.fire;
  var totalCost = roadCost + policeCost + fireCost;
  var cashRemaining = this.totalFunds + this.taxFund - totalCost;

  // Autobudget
  if ((cashRemaining > 0 && this.autoBudget) || fromWindow) {
    // Either we were able to fully fund services, or we have just normalised user input. Go ahead and spend.
    this.awaitingValues = false;
    this.doBudgetSpend(roadCost, fireCost, policeCost);
    return;
  }

  // Uh-oh. Not enough money. Make this the user's problem.
  // They don't know it yet, but they're about to get a budget window.
  this.setAutoBudget(false);
  this.awaitingValues = true;
  this._emitEvent(Messages.BUDGET_NEEDED);
  this._emitEvent(Messages.NO_MONEY);
};


Budget.prototype.doBudgetSpend = function(roadValue, fireValue, policeValue) {
  this.roadSpend = roadValue;
  this.fireSpend = fireValue;
  this.policeSpend = policeValue;
  var total = this.roadSpend + this.fireSpend + this.policeSpend;

  this.spend(-(this.taxFund - total));
  this.updateFundEffects();
};


Budget.prototype.updateFundEffects = function() {
  // The caller is assumed to have correctly set the percentage spend
  this.roadSpend = Math.round(this.roadMaintenanceBudget * this.roadPercent);
  this.fireSpend = Math.round(this.fireMaintenanceBudget * this.firePercent);
  this.policeSpend = Math.round(this.policeMaintenanceBudget * this.policePercent);

  // Update the effect this level of spending will have on infrastructure deterioration
  this.roadEffect = this.MAX_ROAD_EFFECT;
  this.policeEffect = this.MAX_POLICESTATION_EFFECT;
  this.fireEffect = this.MAX_FIRESTATION_EFFECT;

  if (this.roadMaintenanceBudget > 0)
    this.roadEffect = Math.floor(this.roadEffect * this.roadSpend / this.roadMaintenanceBudget);

  if (this.fireMaintenanceBudget > 0)
    this.fireEffect = Math.floor(this.fireEffect * this.fireSpend / this.fireMaintenanceBudget);

  if (this.policeMaintenanceBudget > 0)
    this.policeEffect = Math.floor(this.policeEffect * this.policeSpend / this.policeMaintenanceBudget);
};


Budget.prototype.collectTax = function(gameLevel, census) {
  this.cashFlow = 0;

  // How much would it cost to fully fund every service?
  // PhaiCity: by the stations' levels (src/buildingLevels.ts); an original station costs what it always did
  this.policeMaintenanceBudget = Math.round((census.policeUpkeepUnits ?? census.policeStationPop) * policeMaintenanceCost);
  this.fireMaintenanceBudget = Math.round((census.fireUpkeepUnits ?? census.fireStationPop) * fireMaintenanceCost);

  // PhaiCity: the state pays for its own roads and railways (src/road.js, src/transport.js)
  // ... and the city's roads cost by their levels (src/roadLevels.ts)
  var roadCost = (census.roadUpkeep !== undefined ? census.roadUpkeep :
                  census.roadTotal - (census.nationalRoadTotal || 0)) * roadMaintenanceCost;
  var railCost = (census.railTotal - (census.nationalRailTotal || 0)) * railMaintenanceCost;
  this.roadMaintenanceBudget = Math.floor((roadCost + railCost) * RLevels[gameLevel]);

  // PhaiCity: homes, shops and factories each pay their own rate, on the census's population index of each
  var taxed = census.resPop / 8 * this.cityTax + census.comPop * this.comTax + census.indPop * this.indTax;
  this.taxFund = Math.floor(Math.floor(taxed * census.landValueAverage / 120) * FLevels[gameLevel] *
                            (1 + (this.taxBonus || 0)) * TAX_YIELD);
  // ... kept as its own line, for the year's accounts (src/core/autoPlayer.ts)
  this.taxIncome = this.taxFund;
  // ... and the water fee, for each zone the water reaches (src/waterManager.ts)
  this.waterIncome = Math.floor((census.wateredZoneCount || 0) * this.waterFee);
  this.taxFund += this.waterIncome;
  this.tourismIncome = Math.floor(this.tourismFund);
  this.tourismFund = 0;
  this.taxFund += this.tourismIncome;
  this.miningIncome = Math.floor(this.miningFund);
  this.miningFund = 0;
  this.taxFund += this.miningIncome;
  this.farmIncome = Math.floor(this.farmFund);
  this.farmFund = 0;
  this.taxFund += this.farmIncome;
  // ... and what recycling sold (src/waste.ts)
  this.recyclingIncome = Math.floor(this.wasteFund);
  this.wasteFund = 0;
  this.taxFund += this.recyclingIncome;
  this.tollIncome = Math.floor(this.tollFund);
  this.tollFund = 0;
  this.taxFund += this.tollIncome;
  this.fuelCost = Math.round(census.plantFuel || 0);
  this.taxFund -= this.fuelCost;
  this.houseCost = Math.round(census.rulerHouseUpkeep || 0);
  this.taxFund -= this.houseCost;
  this.educationCost = Math.round(census.educationUpkeep || 0);
  this.healthCost = Math.round(census.healthUpkeep || 0);
  this.taxFund -= this.educationCost + this.healthCost;
  // ... and the rubbish and wastewater buildings' upkeep (src/waste.ts)
  this.wasteCost = Math.round(census.wasteUpkeep || 0);
  this.taxFund -= this.wasteCost;
  // ... and the ruler's policies cost what they cost, and the pollution tax is paid by the factories (src/policies.ts)
  this.taxFund -= this.policyCost || 0;
  this.pollutionTaxIncome = Math.round(census.indPop * (this.pollutionTaxRate || 0));
  this.taxFund += this.pollutionTaxIncome;
  // ... and public transport costs its upkeep (src/transit.ts)
  this.transitCost = Math.round(census.transitUpkeep || 0);
  this.taxFund -= this.transitCost;

  // ... and whether the year's end charges it all: a city no one lives in yet pays and is paid nothing
  this.charged = census.totalPop > 0;
  if (census.totalPop > 0) {
    this.cashFlow = this.taxFund - (this.policeMaintenanceBudget + this.fireMaintenanceBudget + this.roadMaintenanceBudget);
    this.doBudgetNow(false);
  } else {
    // We don't want roads etc deteriorating when population hasn't yet been established
    // (particularly early game)
    this.roadEffect   = this.MAX_ROAD_EFFECT;
    this.policeEffect = this.MAX_POLICESTATION_EFFECT;
    this.fireEffect   = this.MAX_FIRESTATION_EFFECT;
  }
};


Budget.prototype.setTax = function(amount) {
  if (amount === this.cityTax)
    return;

  this.cityTax = amount;
};


// PhaiCity: the taxes on shops and factories and the two fees; any left out keep their value
Budget.prototype.setTaxes = function(rates) {
  if (rates.commercial !== undefined)
    this.comTax = rates.commercial;
  if (rates.industrial !== undefined)
    this.indTax = rates.industrial;
  if (rates.water !== undefined)
    this.waterFee = rates.water;
  if (rates.tourist !== undefined)
    this.touristFee = rates.tourist;
};


// The taxes people feel, for the evaluation and the news: the three zones' rates together
Budget.prototype.averageTax = function() {
  return (this.cityTax + this.comTax + this.indTax) / 3;
};


Budget.prototype.setFunds = function(amount) {
  if (amount === this.totalFunds)
    return;

  this.totalFunds = Math.max(0, amount);

  this._emitEvent(Messages.FUNDS_CHANGED, this.totalFunds);
  if (this.totalFunds === 0)
    this._emitEvent(Messages.NO_MONEY);
};


Budget.prototype.spend = function(amount) {
  this.setFunds(this.totalFunds - amount);
};


Budget.prototype.shouldDegradeRoad = function() {
  return this.roadEffect < Math.floor(15 * this.MAX_ROAD_EFFECT / 16);
};


export { Budget, TAX_YIELD };
