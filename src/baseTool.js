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
import { TileUtils } from './tileUtils.js';
import { DIRT, HBRIDGE, LASTTINYEXP, TINYEXP, TREEBASE, WOODS2 } from "./tileValues.ts";
import { WorldEffects } from './worldEffects.js';

var init = function(cost, map, shouldAutoBulldoze, isDraggable) {
  isDraggable = isDraggable || false;
  Object.defineProperty(this, 'toolCost', MiscUtils.makeConstantDescriptor(cost));
  this.result = null;
  this.isDraggable = isDraggable;
  this._shouldAutoBulldoze = shouldAutoBulldoze;
  this._map = map;
  this._worldEffects = new WorldEffects(map);
  this._applicationCost = 0;
  // PhaiCity (src/provinceRules.ts): this province's price for the tool, and for clearing a tile of woods, which
  // GameTools sets; clearing is charged on its own, outside the tool's price
  this.costFactor = 1;
  this.clearWoodsCost = 1;
  this._clearingCost = 0;
};


var clear = function() {
  this._applicationCost = 0;
  this._clearingCost = 0;
  this._worldEffects.clear();
};


var addCost = function(cost) {
  this._applicationCost += cost;
};


// Natural woods; the trees the park tool plants (WOODS2 and up) are a park, not woods
var isWoods = function(tileValue) {
  return tileValue >= TREEBASE && tileValue < WOODS2;
};


// The cost of bulldozing one tile that held tileValue: woods have the province's clearing price
var addBulldozeCost = function(tileValue, cost) {
  if (isWoods(tileValue))
    this._clearingCost += this.clearWoodsCost;
  else
    this.addCost(cost === undefined ? this.bulldozerCost : cost);
};


// The tiles the tool is about to change, for undo
var pendingTiles = function() {
  return this._worldEffects.positions();
};


// What applying the tool costs in all
var totalCost = function() {
  return Math.round(this._applicationCost * this.costFactor) + this._clearingCost;
};


var doAutoBulldoze = function(x, y) {
  var tile = this._worldEffects.getTile(x, y);
  if (tile.isBulldozable()) {
    tile = TileUtils.normalizeRoad(tile.getValue());
    if ((tile >= TINYEXP && tile <= LASTTINYEXP) ||
        (tile < HBRIDGE && tile !== DIRT)) {
      this.addBulldozeCost(tile, 1);
      this._worldEffects.setTile(x, y, DIRT);
    }
  }
};


var apply = function(budget) {
  this._worldEffects.apply();
  budget.spend(this.totalCost());
  this.clear();
};


var modifyIfEnoughFunding = function(budget) {
  if (this.result !== this.TOOLRESULT_OK) {
    this.clear();
    return false;
  }

  if (budget.totalFunds < this.totalCost()) {
    this.result = this.TOOLRESULT_NO_MONEY;
    this.clear();
    return false;
  }

  apply.call(this, budget);
  this.clear();
  return true;
};


var TOOLRESULT_OK = 0;
var TOOLRESULT_FAILED = 1;
var TOOLRESULT_NO_MONEY = 2;
var TOOLRESULT_NEEDS_BULLDOZE = 3;

var BaseToolConstructor = {
  addBulldozeCost: addBulldozeCost,
  addCost: addCost,
  autoBulldoze: true,
  bulldozerCost: 1,
  clear: clear,
  doAutoBulldoze: doAutoBulldoze,
  init: init,
  modifyIfEnoughFunding: modifyIfEnoughFunding,
  pendingTiles: pendingTiles,
  totalCost: totalCost,
  TOOLRESULT_OK: TOOLRESULT_OK,
  TOOLRESULT_FAILED: TOOLRESULT_FAILED,
  TOOLRESULT_NO_MONEY: TOOLRESULT_NO_MONEY,
  TOOLRESULT_NEEDS_BULLDOZE: TOOLRESULT_NEEDS_BULLDOZE
};


var save = function(saveData) {
  saveData.autoBulldoze = BaseToolConstructor.autoBulldoze;
};


var load = function(saveData) {
  BaseTool.autoBulldoze = saveData.autoBulldoze;
};


var makeTool = function(toolConstructor) {
  toolConstructor.prototype = Object.create(BaseToolConstructor);
  return toolConstructor;
};


var BaseTool = {
  makeTool: makeTool,
  setAutoBulldoze: function(value) {
    BaseToolConstructor.autoBulldoze = value;
  },
  getAutoBulldoze: function() {
    return BaseToolConstructor.autoBulldoze;
  },
  save: save,
  load: load
};

export { BaseTool };
