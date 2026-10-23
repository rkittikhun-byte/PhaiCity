/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's house window (จวนเจ้าเมือง, src/rulerHouse.ts, docs/RULER_HOUSE.md): the house's level, its upkeep and
// its free places, and each wing with what it brings and what it costs, to build or take off. It only reads the
// city and asks the game for "wing" commands (src/cityCommands.ts); taking a wing off asks a second click first.
// Opened from the house button's card above the tools (the "wings" place).

import { formatMoney, onLanguageChange, t } from "./i18n/index";
import { HOUSE_WINDOW_CLOSED } from "./messages";
import { ModalWindow } from "./modalWindow.js";
import { houseSpec, houseUpgradeCost, houseUpkeep, type RulerHouse, type Wing, WING_SPECS, wingRows } from "./rulerHouse";

export interface HouseWindowSource {
  /** The standing house, or null */
  house(): RulerHouse | null;
  funds(): number;
  /** Builds (add) or takes off a wing: true when the city did it */
  changeWing(wing: Wing, add: boolean): boolean;
}

const formID = "#houseForm";
const summaryID = "#houseSummary";
const listID = "#houseWings";

interface HouseWindowThis {
  source: HouseWindowSource | null;
  _confirming: Wing | null;
  _toggleDisplay(): void;
  _emitEvent(event: string, value?: unknown): void;
  render(): void;
  close(): void;
}

export const HouseWindow = (ModalWindow as unknown as (constructor: (this: HouseWindowThis) => void) =>
    { new(opacityLayerID: string, windowID: string): HouseWindowThis; prototype: Record<string, unknown> })(
  function(this: HouseWindowThis) {
    this.source = null;
    this._confirming = null;
    document.querySelector(formID)?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.close();
    });
    onLanguageChange(() => this.render());
  });

HouseWindow.prototype.render = function(this: HouseWindowThis): void {
  const list = document.querySelector(listID);
  const summary = document.querySelector(summaryID);
  const house = this.source?.house() ?? null;
  if (!list || !summary) return;
  if (!house) {
    summary.textContent = t("house.window.none");
    list.replaceChildren();
    return;
  }
  const used = (house.wings ?? []).length;
  summary.textContent = t("house.window.summary", {
    level: String(house.level), name: t(`house.level.${house.level}`), used: String(used),
    room: String(houseSpec(house.level).wings), upkeep: formatMoney(houseUpkeep(house)),
  });
  const rows = wingRows(house, this.source?.funds() ?? 0).map((row) => {
    const spec = WING_SPECS[row.wing];
    const item = document.createElement("li");
    item.className = `houseWing${row.owned ? " owned" : ""}`;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t(`house.wing.${row.wing}`);
    const gain = document.createElement("span");
    gain.className = "wingGain";
    gain.textContent = t(`house.wing.${row.wing}.gain`);
    const cost = document.createElement("span");
    cost.className = "wingCost";
    cost.textContent = t(`house.wing.${row.wing}.cost`);
    const money = document.createElement("span");
    money.className = "wingMoney";
    money.textContent = t("house.wing.money", { price: formatMoney(spec.price), upkeep: formatMoney(spec.upkeep) });
    const why = document.createElement("span");
    why.className = "wingWhy";
    if (row.state === "needs_level") {
      why.textContent = t("house.wing.needs_level", { level: String(house.level + 1), price: formatMoney(houseUpgradeCost(house.level)) });
    }
    const button = document.createElement("button");
    button.type = "button";
    const confirming = row.owned && this._confirming === row.wing;
    button.textContent = t(confirming ? "house.wing.confirm_remove" : `house.wing.state.${row.state}`);
    button.disabled = row.state !== "build" && row.state !== "remove";
    button.addEventListener("click", () => {
      if (!this.source) return;
      if (row.owned && this._confirming !== row.wing) {
        this._confirming = row.wing;
        this.render();
        return;
      }
      this._confirming = null;
      this.source.changeWing(row.wing, !row.owned);
      this.render();
    });
    item.append(name, gain, cost, money, why, button);
    return item;
  });
  list.replaceChildren(...rows);
};

HouseWindow.prototype.open = function(this: HouseWindowThis): void {
  this._confirming = null;
  this.render();
  this._toggleDisplay();
};

HouseWindow.prototype.close = function(this: HouseWindowThis): void {
  this._toggleDisplay();
  this._emitEvent(HOUSE_WINDOW_CLOSED);
};
