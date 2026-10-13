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
import { VALVES_UPDATED } from './messages.ts';
import { MiscUtils } from './miscUtils.js';
import { SKILLED_INDUSTRY, SKILLED_SHOPS } from './services.ts';

var Valves = EventEmitter(function () {
  this.resValve = 0;
  this.comValve = 0;
  this.indValve = 0;
  this.resCap = false;
  this.comCap = false;
  this.indCap = false;
  // PhaiCity: how much more or less each kind of zone is wanted in this province (src/provinceRules.ts)
  this.demand = {residential: 1, commercial: 1, industrial: 1};
  // PhaiCity (src/tourism.ts): the shops the visitors would like, as commercial population, and how much dearer
  // they make living, 0.9–1
  this.touristShops = 0;
  this.livingCost = 1;
  // ... and the factories that process the farms' goods, and the markets and eating places for the harbours' fish
  // (src/farming.ts)
  this.farmFactories = 0;
  this.fishMarkets = 0;
  // ... and what schools and hospitals do (src/services.ts): the families they draw (−0.1 to 0.1 of the homes' ratio),
  // and higher education, 0–1, which draws factories and shops
  this.familyPull = 0;
  this.skilled = 0;
  // ... and the ruler's policies (src/policies.ts): what they add to the homes' ratio, and each kind's share of its demand
  this.policyPull = 0;
  this.policyDemand = {residential: 1, commercial: 1, industrial: 1};
  // ... and the high-speed rail station's trade, which shops want (src/transit.ts)
  this.transitTrade = 1;
});


// PhaiCity: how much less the homes are wanted for each baht of the water fee (src/budget.js): ฿10 takes 0.06 off
var WATER_FEE_PULL = 0.006;

var RES_VALVE_RANGE = 2000;
var COM_VALVE_RANGE = 1500;
var IND_VALVE_RANGE = 1500;


var taxTable = [
  200, 150, 120, 100, 80, 50, 30, 0, -10, -40, -100,
  -150, -200, -250, -300, -350, -400, -450, -500, -550, -600];
var extMarketParamTable = [1.2, 1.1, 0.98];

Valves.prototype.save = function(saveData) {
  saveData.resValve = this.resValve;
  saveData.comValve = this.comValve;
  saveData.indValve = this.indValve;
};


Valves.prototype.load = function(saveData) {
  this.resValve = saveData.resValve;
  this.comValve = saveData.comValve;
  this.indValve = saveData.indValve;

  this._emitEvent(VALVES_UPDATED);
};


Valves.prototype.setValves = function(gameLevel, census, budget) {
  var resPopDenom = 8;
  var birthRate = 0.02;
  var labourBaseMax = 1.3;
  var internalMarketDenom = 3.7;
  var projectedIndPopMin = 5.0;
  var resRatioDefault = 1.3;
  var resRatioMax = 2;
  var comRatioMax = 2;
  var indRatioMax = 2;
  var taxMax = 20;
  var taxTableScale = 600;
  var employment, labourBase;

  // Residential zones scale their population index when reporting it to the census
  var normalizedResPop = census.resPop / resPopDenom;
  census.totalPop = Math.round(normalizedResPop + census.comPop + census.indPop);

  // A lack of developed commercial and industrial zones means there are no employment opportunities, which constrain
  // growth. (This might hurt initially if, for example, the player lays out an initial grid, as the residential zones
  // will likely develop first, so the residential valve will immediately crater).
  if (census.resPop > 0)
    employment = (census.comHist10[1] + census.indHist10[1]) / normalizedResPop;
  else
    employment = 1;

  // Given the employment rate, calculate expected migration, add in births, and project the new population.
  var migration = normalizedResPop * (employment - 1);
  var births = normalizedResPop * birthRate;
  var projectedResPop = normalizedResPop + migration + births;

  // Examine how many zones require workers
  labourBase = census.comHist10[1] + census.indHist10[1];
  if (labourBase > 0.0)
    labourBase = census.resHist10[1] / labourBase;
  else
    labourBase = 1;
  labourBase = MiscUtils.clamp(labourBase, 0.0, labourBaseMax);

  // Project future industry and commercial needs, taking into account available labour, and competition from
  // other global cities
  var internalMarket = (normalizedResPop + census.comPop + census.indPop) / internalMarketDenom;
  var projectedComPop = internalMarket * labourBase + this.touristShops + this.fishMarkets;
  var projectedIndPop = census.indPop * labourBase * extMarketParamTable[gameLevel] + this.farmFactories;
  projectedIndPop = Math.max(projectedIndPop, projectedIndPopMin);

  // Calculate the expected percentage changes in each population type
  var resRatio;
  if (normalizedResPop > 0)
    resRatio = projectedResPop / normalizedResPop;
  else
    resRatio = resRatioDefault;

  var comRatio;
  if (census.comPop > 0)
    comRatio = projectedComPop / census.comPop;
  else
    comRatio = projectedComPop;

  var indRatio;
  if (census.indPop > 0)
    indRatio = projectedIndPop / census.indPop;
  else
    indRatio = projectedIndPop;

  // The province's own appetite for each kind of zone; visitors make living dearer, a little, and so does the water fee
  // (src/budget.js)
  resRatio -= (1 - this.livingCost) * 0.3;
  resRatio -= (budget.waterFee || 0) * WATER_FEE_PULL;
  // Schools and hospitals draw families; skilled people draw factories and shops (src/services.ts)
  resRatio += this.familyPull;
  comRatio *= 1 + SKILLED_SHOPS * this.skilled;
  indRatio *= 1 + SKILLED_INDUSTRY * this.skilled;
  // The ruler's policies (src/policies.ts)
  resRatio = (resRatio + this.policyPull) * this.policyDemand.residential;
  comRatio *= this.policyDemand.commercial * this.transitTrade;
  indRatio *= this.policyDemand.industrial;
  resRatio *= this.demand.residential;
  comRatio *= this.demand.commercial;
  indRatio *= this.demand.industrial;

  resRatio = Math.min(resRatio, resRatioMax);
  comRatio = Math.min(comRatio, comRatioMax);
  indRatio = Math.min(indRatio, indRatioMax);

  // Constrain growth according to the tax level: PhaiCity, each kind of zone by its own rate (src/budget.js)
  var zone = function(rate) {
    return Math.min(((typeof rate === 'number' ? rate : budget.cityTax) + gameLevel), taxMax);
  };
  resRatio = (resRatio - 1) * taxTableScale + taxTable[zone(budget.cityTax)];
  comRatio = (comRatio - 1) * taxTableScale + taxTable[zone(budget.comTax)];
  indRatio = (indRatio - 1) * taxTableScale + taxTable[zone(budget.indTax)];

  this.resValve = MiscUtils.clamp(this.resValve + Math.round(resRatio), -RES_VALVE_RANGE, RES_VALVE_RANGE);
  this.comValve = MiscUtils.clamp(this.comValve + Math.round(comRatio), -COM_VALVE_RANGE, COM_VALVE_RANGE);
  this.indValve = MiscUtils.clamp(this.indValve + Math.round(indRatio), -IND_VALVE_RANGE, IND_VALVE_RANGE);

  if (this.resCap && this.resValve > 0)
    this.resValve = 0;

  if (this.comCap && this.comValve > 0)
      this.comValve = 0;

  if (this.indCap && this.indValve > 0)
      this.indValve = 0;

  this._emitEvent(VALVES_UPDATED);
};


export { Valves };
