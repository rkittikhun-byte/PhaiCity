/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Tourism (การท่องเที่ยว, docs/TOURISM.md), the first of the province's resources to count in the game (owner,
// 13 Oct 2026; docs/PROVINCE_PROFILE.md). Once a month visitors come to the city:
// - how many want to come: the province's tourism level (0–5), how well known the city has become, the season (most
//   in the cool dry months, fewest in the rains), and how pleasant the city is: its land value, an airport, a stadium
//   and a seaport bring more; pollution and crime drive them away;
// - how many the city can take in: its shops, hotels and markets (the commercial zones' population);
// - what they bring: the money they spend (paid into the year's taxes), and more shops wanted;
// - what they cost: more traffic to and from the shops, rubbish (a little pollution in busy shopping streets), and
//   dearer living, so a little less demand for homes.
// A pure function of the city's census: no DOM, no randomness, so a server replays it (CLAUDE.md, "Online plan").

/** How strongly each month draws visitors, January first: the cool dry high season, the hot months, the rains */
export const TOURISM_SEASON: readonly number[] = [1.4, 1.4, 1.0, 1.0, 0.6, 0.6, 0.6, 0.6, 0.6, 1.0, 1.4, 1.4];
/** Visitors a month at each tourism level, in an ordinary month, to a well-known and pleasant city */
export const VISITORS_AT_LEVEL: readonly number[] = [0, 150, 350, 700, 1200, 2000];
/** Visitors one unit of the commercial zones' population takes in a month */
export const VISITORS_PER_SHOP = 25;
/** Baht the city takes from each visit, in fees and taxes */
export const SPEND_PER_VISITOR = 0.1;
/** The city's population (the census' total) at which the province's whole draw reaches it */
const KNOWN_AT_POP = 300;
const LEAST_KNOWN = 0.15;
/** Shops the visitors ask for, as a share of what would take them all in */
const SHOP_WANT_SHARE = 0.5;
/** Pollution a busy shopping tile gets from the visitors' rubbish, at its busiest */
const MOST_RUBBISH = 20;

export interface TourismCensus {
  totalPop: number;
  comPop: number;
  stadiumPop: number;
  airportPop: number;
  seaportPop: number;
  landValueAverage: number;
  pollutionAverage: number;
  crimeAverage: number;
}

export interface TourismMonth {
  /** The province's tourism level, 0–5 */
  level: number;
  /** Visitors who came this month */
  visitors: number;
  /** Visitors who wanted to come */
  wanted: number;
  /** How pleasant the city is to visit, 0 to 1.5 */
  appeal: number;
  /** How much pollution and crime took off the appeal */
  pollutionPenalty: number;
  crimePenalty: number;
  /** Baht the visitors left with the city this month */
  income: number;
  /** This month's draw (TOURISM_SEASON) */
  season: number;
  /** How full the shops are of visitors, 0–1: their traffic and rubbish follow it */
  busy: number;
  /** Commercial population the visitors would like there to be */
  shopsWanted: number;
  /** Visitors over the city's population, 0–1: dearer living for the people */
  pressure: number;
}

export const NO_TOURISM: TourismMonth = {
  level: 0, visitors: 0, wanted: 0, appeal: 0, pollutionPenalty: 0, crimePenalty: 0, income: 0, season: 1, busy: 0,
  shopsWanted: 0, pressure: 0,
};

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/** One month of visitors. month is 0–11, as the game counts it. */
export function tourismMonth(level: number, census: TourismCensus, month: number): TourismMonth {
  const lvl = clamp(Math.round(level), 0, VISITORS_AT_LEVEL.length - 1);
  if (lvl === 0) return NO_TOURISM;
  const pollutionPenalty = Math.max(0, census.pollutionAverage - 40) / 60;
  const crimePenalty = Math.max(0, census.crimeAverage - 40) / 80;
  const appeal = clamp(0.6 + Math.min(census.landValueAverage, 200) / 200 * 0.4 +
    (census.airportPop > 0 ? 0.25 : 0) + (census.stadiumPop > 0 ? 0.1 : 0) + (census.seaportPop > 0 ? 0.1 : 0) -
    pollutionPenalty - crimePenalty, 0, 1.5);
  const known = clamp(census.totalPop / KNOWN_AT_POP, LEAST_KNOWN, 1);
  const season = TOURISM_SEASON[((month % 12) + 12) % 12];
  const wanted = Math.round(VISITORS_AT_LEVEL[lvl] * appeal * known * season);
  const capacity = Math.max(0, census.comPop) * VISITORS_PER_SHOP;
  const visitors = Math.min(wanted, capacity);
  return {
    level: lvl,
    visitors,
    wanted,
    appeal,
    pollutionPenalty,
    crimePenalty,
    income: Math.round(visitors * SPEND_PER_VISITOR),
    season,
    busy: capacity > 0 ? visitors / capacity : 0,
    shopsWanted: wanted / VISITORS_PER_SHOP * SHOP_WANT_SHARE,
    pressure: clamp(visitors / (Math.max(1, census.totalPop) * 10), 0, 1),
  };
}

/** Pollution from the visitors' rubbish on each shopping tile (src/blockMapUtils.js). */
export function shopRubbish(month: TourismMonth): number {
  return Math.round(MOST_RUBBISH * month.busy);
}

/** Extra chances a shop has each scan to send out traffic, 0–2 (src/commercial.js): the visitors' trips. */
export function touristTrips(month: TourismMonth): number {
  return Math.round(2 * month.busy);
}

/** The share of their demand homes keep when living gets dearer, 0.9–1 (src/valves.js). */
export function livingCostFactor(month: TourismMonth): number {
  return 1 - 0.1 * month.pressure;
}
