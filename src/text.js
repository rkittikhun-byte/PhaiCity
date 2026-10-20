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

import { Evaluation } from './evaluation.js';
import * as Messages from './messages.ts';
import { Simulation } from './simulation.js';
import { t } from './i18n/index.ts';

// Every player-visible string is an i18n key (src/i18n, translations in docs/i18n/UI_STRINGS.md).
// The Text properties below are getters, so they always return the current language.

// Query tool strings
var densityKeys = ['density.low', 'density.med', 'density.high', 'density.vhigh'];
var landValueKeys = ['landval.slum', 'landval.lclass', 'landval.mclass', 'landval.high'];
var crimeKeys = ['crime.safe', 'crime.light', 'crime.mod', 'crime.danger'];
var pollutionKeys = ['poll.none', 'poll.mod', 'poll.heavy', 'poll.vheavy'];
var rateKeys = ['growth.declining', 'growth.stable', 'growth.slow', 'growth.fast'];
var zoneTypeKeys = ['zone.clear', 'zone.water', 'zone.trees', 'zone.rubble', 'zone.flood', 'zone.radwaste',
                    'zone.fire', 'zone.road', 'zone.power', 'zone.rail', 'zone.residential', 'zone.commercial',
                    'zone.industrial', 'zone.seaport', 'zone.airport', 'zone.coal', 'zone.fire_dept',
                    'zone.police_dept', 'zone.stadium', 'zone.nuclear', 'zone.drawbridge',
                    'zone.radardish', 'zone.fountain', 'zone.industrial', 'zone.easter_egg',
                    'zone.drawbridge', 'zone.ur238'];

// Evaluation window
var gameLevelKeys = {};
gameLevelKeys['' + Simulation.LEVEL_EASY] = 'diff.easy';
gameLevelKeys['' + Simulation.LEVEL_MED] = 'diff.med';
gameLevelKeys['' + Simulation.LEVEL_HARD] = 'diff.hard';

var cityClassKeys = {};
cityClassKeys[Evaluation.CC_VILLAGE] = 'city.village';
cityClassKeys[Evaluation.CC_TOWN] = 'city.town';
cityClassKeys[Evaluation.CC_CITY] = 'city.city';
cityClassKeys[Evaluation.CC_CAPITAL] = 'city.capital';
cityClassKeys[Evaluation.CC_METROPOLIS] = 'city.metropolis';
cityClassKeys[Evaluation.CC_MEGALOPOLIS] = 'city.megalopolis';

var problemKeys = {};
problemKeys[Evaluation.CRIME] = 'prob.crime';
problemKeys[Evaluation.POLLUTION] = 'prob.pollution';
problemKeys[Evaluation.HOUSING] = 'prob.housing';
problemKeys[Evaluation.TAXES] = 'prob.taxes';
problemKeys[Evaluation.TRAFFIC] = 'prob.traffic';
problemKeys[Evaluation.UNEMPLOYMENT] = 'prob.unemployment';
problemKeys[Evaluation.FIRE] = 'prob.fire';

// months
var monthKeys = ['month.jan', 'month.feb', 'month.mar', 'month.apr', 'month.may', 'month.jun',
                 'month.jul', 'month.aug', 'month.sep', 'month.oct', 'month.nov', 'month.dec'];

// Tool strings
var toolMessageKeys = {
  noMoney: 'tool.msg.no_money',
  needsDoze: 'tool.msg.needs_doze'
};

// Message strings
var neutralMessages = {};
neutralMessages[Messages.FIRE_STATION_NEEDS_FUNDING] = true;
neutralMessages[Messages.NEED_AIRPORT] = true;
neutralMessages[Messages.NEED_FIRE_STATION] = true;
neutralMessages[Messages.NEED_ELECTRICITY] = true;
neutralMessages[Messages.NEED_MORE_INDUSTRIAL] = true;
neutralMessages[Messages.NEED_MORE_COMMERCIAL] = true;
neutralMessages[Messages.NEED_MORE_RESIDENTIAL] = true;
neutralMessages[Messages.NEED_MORE_RAILS] = true;
neutralMessages[Messages.NEED_MORE_ROADS] = true;
neutralMessages[Messages.NEED_POLICE_STATION] = true;
neutralMessages[Messages.NEED_SEAPORT] = true;
neutralMessages[Messages.NEED_STADIUM] = true;
neutralMessages[Messages.NEED_WATER] = true;
neutralMessages[Messages.ROAD_NEEDS_FUNDING] = true;
neutralMessages[Messages.POLICE_NEEDS_FUNDING] = true;
neutralMessages[Messages.WELCOME] = true;

var badMessages = {};
badMessages[Messages.BLACKOUTS_REPORTED] = true;
badMessages[Messages.EARTHQUAKE] = true;
badMessages[Messages.EXPLOSION_REPORTED] = true;
badMessages[Messages.FLOODING_REPORTED] = true;
badMessages[Messages.FIRE_REPORTED] = true;
badMessages[Messages.HEAVY_TRAFFIC] = true;
badMessages[Messages.HELICOPTER_CRASHED] = true;
badMessages[Messages.HIGH_CRIME] = true;
badMessages[Messages.HIGH_POLLUTION] = true;
badMessages[Messages.MONSTER_SIGHTED] = true;
badMessages[Messages.NO_MONEY] = true;
badMessages[Messages.NOT_ENOUGH_POWER] = true;
badMessages[Messages.NOT_ENOUGH_WATER] = true;
badMessages[Messages.GROUNDWATER_LOW] = true;
badMessages[Messages.NUCLEAR_MELTDOWN] = true;
badMessages[Messages.PLANE_CRASHED] = true;
badMessages[Messages.SHIP_CRASHED] = true;
badMessages[Messages.TAX_TOO_HIGH] = true;
badMessages[Messages.TORNADO_SIGHTED] = true;
badMessages[Messages.TRAFFIC_JAMS] = true;
badMessages[Messages.TRAIN_CRASHED] = true;
badMessages[Messages.TOURISTS_AVOID_CRIME] = true;
badMessages[Messages.TOURISTS_AVOID_POLLUTION] = true;
badMessages[Messages.MINE_EXHAUSTED] = true;
badMessages[Messages.OIL_SPILL] = true;
badMessages[Messages.TOXIC_GROUND] = true;
badMessages[Messages.HAZE] = true;
badMessages[Messages.FEW_FISH] = true;
badMessages[Messages.DIRTY_HARBOUR] = true;
badMessages[Messages.RULER_HOUSE_LOST] = true;
badMessages[Messages.FEW_SCHOOLS] = true;
badMessages[Messages.FEW_HOSPITALS] = true;
badMessages[Messages.RUBBISH_OVERFLOW] = true;
badMessages[Messages.LANDFILL_FULL] = true;
badMessages[Messages.LANDFILL_NEARLY_FULL] = true;
badMessages[Messages.UNTREATED_SEWAGE] = true;
badMessages[Messages.FIRE_SEASON_AHEAD] = true;
badMessages[Messages.FLOOD_SEASON_AHEAD] = true;
badMessages[Messages.STORM_SEASON_AHEAD] = true;
badMessages[Messages.HEAVY_STORM] = true;

var goodMessages = {};
goodMessages[Messages.REACHED_CAPITAL] = true;
goodMessages[Messages.REACHED_CITY] = true;
goodMessages[Messages.REACHED_MEGALOPOLIS] = true;
goodMessages[Messages.REACHED_METROPOLIS] = true;
goodMessages[Messages.REACHED_TOWN] = true;
goodMessages[Messages.TOURIST_SEASON] = true;
goodMessages[Messages.SONGKRAN] = true;
goodMessages[Messages.NEW_YEAR_HOLIDAYS] = true;
goodMessages[Messages.FIRST_RAINS] = true;

var messageKeys = {};
messageKeys[Messages.FIRE_STATION_NEEDS_FUNDING] = 'msg.fund.fire';
messageKeys[Messages.NEED_AIRPORT] = 'msg.need.airport';
messageKeys[Messages.NEED_FIRE_STATION] = 'msg.need.fire_station';
messageKeys[Messages.NEED_ELECTRICITY] = 'msg.need.electricity';
messageKeys[Messages.NEED_MORE_INDUSTRIAL] = 'msg.need.more_ind';
messageKeys[Messages.NEED_MORE_COMMERCIAL] = 'msg.need.more_com';
messageKeys[Messages.NEED_MORE_RESIDENTIAL] = 'msg.need.more_res';
messageKeys[Messages.NEED_MORE_RAILS] = 'msg.need.more_rails';
messageKeys[Messages.NEED_MORE_ROADS] = 'msg.need.more_roads';
messageKeys[Messages.NEED_POLICE_STATION] = 'msg.need.police_station';
messageKeys[Messages.NEED_SEAPORT] = 'msg.need.seaport';
messageKeys[Messages.NEED_STADIUM] = 'msg.need.stadium';
messageKeys[Messages.NEED_WATER] = 'msg.need.water';
messageKeys[Messages.ROAD_NEEDS_FUNDING] = 'msg.fund.road';
messageKeys[Messages.POLICE_NEEDS_FUNDING] = 'msg.fund.police';
messageKeys[Messages.WELCOME] = 'msg.welcome';
messageKeys[Messages.BLACKOUTS_REPORTED] = 'msg.bad.blackouts';
messageKeys[Messages.EARTHQUAKE] = 'msg.bad.earthquake';
messageKeys[Messages.EXPLOSION_REPORTED] = 'msg.bad.explosion';
messageKeys[Messages.FLOODING_REPORTED] = 'msg.bad.flooding';
messageKeys[Messages.FIRE_REPORTED] = 'msg.bad.fire';
messageKeys[Messages.HEAVY_TRAFFIC] = 'msg.bad.heavy_traffic';
messageKeys[Messages.HELICOPTER_CRASHED] = 'msg.bad.helicopter_crash';
messageKeys[Messages.HIGH_CRIME] = 'msg.bad.high_crime';
messageKeys[Messages.HIGH_POLLUTION] = 'msg.bad.high_pollution';
messageKeys[Messages.MONSTER_SIGHTED] = 'msg.bad.monster';
messageKeys[Messages.NO_MONEY] = 'msg.bad.no_money';
messageKeys[Messages.NOT_ENOUGH_POWER] = 'msg.bad.not_enough_power';
messageKeys[Messages.NOT_ENOUGH_WATER] = 'msg.bad.not_enough_water';
messageKeys[Messages.GROUNDWATER_LOW] = 'msg.bad.groundwater_low';
messageKeys[Messages.NUCLEAR_MELTDOWN] = 'msg.bad.meltdown';
messageKeys[Messages.PLANE_CRASHED] = 'msg.bad.plane_crash';
messageKeys[Messages.SHIP_CRASHED] = 'msg.bad.ship_crash';
messageKeys[Messages.TAX_TOO_HIGH] = 'msg.bad.tax_too_high';
messageKeys[Messages.TORNADO_SIGHTED] = 'msg.bad.tornado';
messageKeys[Messages.TRAFFIC_JAMS] = 'msg.bad.traffic_jams';
messageKeys[Messages.TRAIN_CRASHED] = 'msg.bad.train_crash';
messageKeys[Messages.REACHED_CAPITAL] = 'msg.good.reach_capital';
messageKeys[Messages.REACHED_CITY] = 'msg.good.reach_city';
messageKeys[Messages.REACHED_MEGALOPOLIS] = 'msg.good.reach_megalopolis';
messageKeys[Messages.REACHED_METROPOLIS] = 'msg.good.reach_metro';
messageKeys[Messages.REACHED_TOWN] = 'msg.good.reach_town';
messageKeys[Messages.TOURIST_SEASON] = 'msg.good.tourist_season';
messageKeys[Messages.SONGKRAN] = 'msg.good.songkran';
messageKeys[Messages.NEW_YEAR_HOLIDAYS] = 'msg.good.new_year';
messageKeys[Messages.TOURISTS_AVOID_CRIME] = 'msg.bad.tourists_crime';
messageKeys[Messages.TOURISTS_AVOID_POLLUTION] = 'msg.bad.tourists_pollution';
messageKeys[Messages.MINE_EXHAUSTED] = 'msg.bad.mine_exhausted';
messageKeys[Messages.OIL_SPILL] = 'msg.bad.oil_spill';
messageKeys[Messages.TOXIC_GROUND] = 'msg.bad.toxic_ground';
messageKeys[Messages.HAZE] = 'msg.bad.haze';
messageKeys[Messages.FEW_FISH] = 'msg.bad.few_fish';
messageKeys[Messages.DIRTY_HARBOUR] = 'msg.bad.dirty_harbour';
messageKeys[Messages.RULER_HOUSE_LOST] = 'msg.bad.ruler_house_lost';
messageKeys[Messages.FEW_SCHOOLS] = 'msg.bad.few_schools';
messageKeys[Messages.FEW_HOSPITALS] = 'msg.bad.few_hospitals';
messageKeys[Messages.RUBBISH_OVERFLOW] = 'msg.bad.rubbish_overflow';
messageKeys[Messages.LANDFILL_FULL] = 'msg.bad.landfill_full';
messageKeys[Messages.LANDFILL_NEARLY_FULL] = 'msg.bad.landfill_nearly_full';
messageKeys[Messages.UNTREATED_SEWAGE] = 'msg.bad.untreated_sewage';
messageKeys[Messages.FIRE_SEASON_AHEAD] = 'msg.bad.fire_season_ahead';
messageKeys[Messages.FLOOD_SEASON_AHEAD] = 'msg.bad.flood_season_ahead';
messageKeys[Messages.STORM_SEASON_AHEAD] = 'msg.bad.storm_season_ahead';
messageKeys[Messages.HEAVY_STORM] = 'msg.bad.heavy_storm';
messageKeys[Messages.FIRST_RAINS] = 'msg.good.first_rains';


var translateList = function(keys) {
  return keys.map(function(key) { return t(key); });
};

var translateTable = function(keys) {
  var result = {};
  Object.keys(keys).forEach(function(id) { result[id] = t(keys[id]); });
  return result;
};

var Text = {
  badMessages: badMessages,
  goodMessages: goodMessages,
  neutralMessages: neutralMessages
};

var translated = {
  cityClass: translateTable.bind(null, cityClassKeys),
  crimeStrings: translateList.bind(null, crimeKeys),
  densityStrings: translateList.bind(null, densityKeys),
  gameLevel: translateTable.bind(null, gameLevelKeys),
  landValueStrings: translateList.bind(null, landValueKeys),
  messageText: translateTable.bind(null, messageKeys),
  months: translateList.bind(null, monthKeys),
  problems: translateTable.bind(null, problemKeys),
  pollutionStrings: translateList.bind(null, pollutionKeys),
  rateStrings: translateList.bind(null, rateKeys),
  toolMessages: translateTable.bind(null, toolMessageKeys),
  zoneTypes: translateList.bind(null, zoneTypeKeys)
};

Object.keys(translated).forEach(function(name) {
  Object.defineProperty(Text, name, {get: translated[name], enumerable: true});
});

export { Text };
