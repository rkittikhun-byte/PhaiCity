/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The status at the top left of the city (owner, 12 Oct 2026): a row of small blocks, each with its topic above and
// its number below: the city, the date, the money, the people, and what homes, shops and factories want (the demand
// bars' numbers, as a percentage) with how many people live or work in each. The name, date, money and population
// are copied from the city card, which src/infoBar.js keeps up to date; the rest comes from the simulation.

import { formatMoney, onLanguageChange, t } from "./i18n/index";
import { POPULATION_UPDATED, SERVICES_UPDATED, TOURISM_UPDATED, VALVES_UPDATED, WASTE_UPDATED } from "./messages";
import { type ServiceLevels, SERVICES_FROM } from "./services";
import type { TourismMonth } from "./tourism";
import { WASTE_FROM, type WasteMonth } from "./waste";

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

/**
 * The visitors block (src/tourism.ts): how many came this month, shown only in a province with tourism; pointing at
 * it tells what they spent and whether it is the high season.
 */
export function showTourism(simulation: { addEventListener(event: string, listener: (value: unknown) => void): void },
    doc: Document = document): void {
  let month: TourismMonth | null = null;
  const render = (): void => {
    const block = doc.getElementById("statusTourism");
    if (!block) return;
    const shown = month !== null && (month.level > 0 || month.festival !== null);
    block.hidden = !shown;
    if (!month || !shown) return;
    const value = block.querySelector(".statValue");
    if (value) value.textContent = t("status.tourists_value", { count: month.visitors.toLocaleString("en-US") });
    const params = { income: formatMoney(month.income), wanted: month.wanted.toLocaleString("en-US"),
      festival: month.festival ? t(`festival.${month.festival}`) : "" };
    block.title = t(month.festival ? "status.tourists_festival" : month.season > 1 ? "status.tourists_high"
      : month.season < 1 ? "status.tourists_low" : "status.tourists_title", params);
  };
  simulation.addEventListener(TOURISM_UPDATED, (value) => {
    month = value as TourismMonth;
    render();
  });
  onLanguageChange(render);
  render();
}

/**
 * The schools and hospitals block (src/services.ts): their levels, 0–100, once the city has any of them or has people
 * enough for them to count; pointing at it tells what each level is.
 */
export function showServices(simulation: { addEventListener(event: string, listener: (value: unknown) => void): void },
    doc: Document = document): void {
  let levels: ServiceLevels | null = null;
  const render = (): void => {
    const block = doc.getElementById("statusServices");
    if (!block) return;
    block.hidden = !levels || levels.people < SERVICES_FROM;
    if (!levels || block.hidden) return;
    const value = block.querySelector(".statValue");
    if (value) value.textContent = t("status.services_value", { school: levels.basic, health: levels.health });
    block.title = t("status.services_title", { school: levels.basic, higher: levels.higher, health: levels.health });
  };
  simulation.addEventListener(SERVICES_UPDATED, (value) => {
    levels = value as ServiceLevels;
    render();
  });
  onLanguageChange(render);
  render();
}

/**
 * The rubbish and wastewater block (src/waste.ts): how much of the month's rubbish was taken and of the sewage treated,
 * once the city has people enough for them to count or any of their buildings; pointing at it tells the tonnes.
 */
export function showWaste(simulation: { addEventListener(event: string, listener: (value: unknown) => void): void },
    doc: Document = document): void {
  let month: WasteMonth | null = null;
  const render = (): void => {
    const block = doc.getElementById("statusWaste");
    if (!block) return;
    block.hidden = !month || (month.people < WASTE_FROM && month.buildings === 0);
    if (!month || block.hidden) return;
    const value = block.querySelector(".statValue");
    if (value) value.textContent = t("status.waste_value", { rubbish: month.rubbishShare, sewage: month.sewageShare });
    block.title = t("status.waste_title", { rubbish: month.rubbishShare, tonnes: Math.round(month.rubbish),
      sewage: month.sewageShare });
  };
  simulation.addEventListener(WASTE_UPDATED, (value) => {
    month = value as WasteMonth;
    render();
  });
  onLanguageChange(render);
  render();
}
