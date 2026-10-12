/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The status at the top left of the city (owner, 12 Oct 2026): a row of small blocks, each with its topic above and
// its number below: the city, the date, the money, the people, and what homes, shops and factories want (the demand
// bars' numbers, as a percentage) with how many people live or work in each. The name, date, money and population
// are copied from the city card, which src/infoBar.js keeps up to date; the rest comes from the simulation.

import { formatMoney, onLanguageChange, t } from "./i18n/index";
import { POPULATION_UPDATED, VALVES_UPDATED } from "./messages";

/** How the money reads in the status: ฿16,295. Anything that is not a number is shown as it is. */
export function statusMoney(text: string): string {
  const amount = Number(text.replace(/[^\d-]/g, ""));
  return text.trim() !== "" && Number.isFinite(amount) ? formatMoney(amount).replace(/\d+/, (digits) =>
    Number(digits).toLocaleString("en-US")) : text;
}

/** A demand valve (-2000 to 2000, the bars' scale) as a percentage of the most it can want. */
export function demandPercent(valve: number): number {
  return Math.round(Math.max(-2000, Math.min(2000, valve)) / 20);
}

/** "+40%", "−10%", "0%". */
export function formatPercent(percent: number): string {
  return percent > 0 ? `+${percent}%` : percent < 0 ? `−${-percent}%` : "0%";
}

export interface ZoneCensus { resPop: number; comPop: number; indPop: number }

/**
 * How many people live in the homes and work in the shops and factories: the parts of the game's own population
 * figure, (homes + (shops + factories) × 8) × 20 (src/evaluation.js), so the three add up to it.
 */
export function zonePeople(census: ZoneCensus): { residential: number; commercial: number; industrial: number } {
  return { residential: census.resPop * 20, commercial: census.comPop * 160, industrial: census.indPop * 160 };
}

/** Copies the city card's name, date, money and population into the status, as they change. */
export function installCityStatus(doc: Document = document): void {
  const copies: Array<[string, string, (text: string) => string]> = [
    ["name", "statusName", (text) => text],
    ["date", "statusDate", (text) => text],
    ["funds", "statusFunds", statusMoney],
    ["population", "statusPopulation", (text) => (Number(text) || 0).toLocaleString("en-US")],
  ];
  for (const [from, to, format] of copies) {
    const source = doc.getElementById(from);
    const target = doc.getElementById(to);
    if (!source || !target) continue;
    const copy = (): void => {
      target.textContent = format(source.textContent ?? "");
    };
    copy();
    new MutationObserver(copy).observe(source, { childList: true, characterData: true, subtree: true });
  }
}

interface StatusSource {
  addEventListener(event: string, listener: (value: unknown) => void): void;
  _census: ZoneCensus;
  _valves: { resValve: number; comValve: number; indValve: number };
}

const ZONES = ["residential", "commercial", "industrial"] as const;

/**
 * Keeps the homes, shops and factories blocks up to date: the demand whenever the simulation sets it, the people
 * when the population is counted (the census is complete then, so the three add up to the population shown).
 */
export function showDemandAndPeople(simulation: StatusSource, doc: Document = document): void {
  let demand = { residential: simulation._valves.resValve, commercial: simulation._valves.comValve,
    industrial: simulation._valves.indValve };
  let people = zonePeople(simulation._census);
  const render = (): void => {
    for (const zone of ZONES) {
      const block = doc.querySelector(`#cityStatus [data-zone="${zone}"]`);
      if (!block) continue;
      const percent = demandPercent(demand[zone]);
      const mark = block.querySelector(".statPercent");
      if (mark) {
        mark.textContent = formatPercent(percent);
        mark.classList.toggle("up", percent > 0);
        mark.classList.toggle("down", percent < 0);
      }
      const value = block.querySelector(".statValue");
      if (value) value.textContent = t("status.people", { count: people[zone].toLocaleString("en-US") });
    }
  };
  simulation.addEventListener(VALVES_UPDATED, (value) => {
    demand = value as typeof demand;
    render();
  });
  simulation.addEventListener(POPULATION_UPDATED, () => {
    people = zonePeople(simulation._census);
    render();
  });
  onLanguageChange(render);
  render();
}
