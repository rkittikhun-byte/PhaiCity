/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's policies window (นโยบายเจ้าเมือง, src/policies.ts, docs/POLICIES.md): the room for policies and what the
// ones at work cost a year, and each policy with what it brings and what it costs, to switch on or off. It only reads
// the city and asks the game for "policy" commands (src/cityCommands.ts). Opened from the house button's card above
// the tools (the "policies" place).

import { formatMoney, onLanguageChange, t } from "./i18n/index";
import { POLICY_WINDOW_CLOSED } from "./messages";
import { ModalWindow } from "./modalWindow.js";
import { type Policy, POLICY_UPKEEP, policiesInForce, type PolicyMap, policyRows, policySlots, policyUpkeep } from "./policies";

export interface PolicyWindowSource {
  map(): PolicyMap;
  /** Switches a policy on or off: true when the city did it */
  change(policy: Policy, on: boolean): boolean;
}

const formID = "#policyForm";
const summaryID = "#policySummary";
const listID = "#policyList";

interface PolicyWindowThis {
  source: PolicyWindowSource | null;
  _toggleDisplay(): void;
  _emitEvent(event: string, value?: unknown): void;
  render(): void;
  close(): void;
}

export const PolicyWindow = (ModalWindow as unknown as (constructor: (this: PolicyWindowThis) => void) =>
    { new(opacityLayerID: string, windowID: string): PolicyWindowThis; prototype: Record<string, unknown> })(
  function(this: PolicyWindowThis) {
    this.source = null;
    document.querySelector(formID)?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.close();
    });
    onLanguageChange(() => this.render());
  });

PolicyWindow.prototype.render = function(this: PolicyWindowThis): void {
  const list = document.querySelector(listID);
  const summary = document.querySelector(summaryID);
  const map = this.source?.map();
  if (!list || !summary || !map) return;
  const room = policySlots(map);
  summary.textContent = room === 0 ? t("policy.window.none") : t("policy.window.summary", {
    used: String(policiesInForce(map).length), room: String(room), upkeep: formatMoney(policyUpkeep(map)),
  });
  const rows = policyRows(map).map((row) => {
    const item = document.createElement("li");
    item.className = `houseWing${row.on ? " owned" : ""}`;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = t(`policy.${row.policy}`);
    const gain = document.createElement("span");
    gain.className = "wingGain";
    gain.textContent = t(`policy.${row.policy}.gain`);
    const cost = document.createElement("span");
    cost.className = "wingCost";
    cost.textContent = t(`policy.${row.policy}.cost`);
    const money = document.createElement("span");
    money.className = "wingMoney";
    money.textContent = t("policy.money", { upkeep: formatMoney(POLICY_UPKEEP[row.policy]) });
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = t(`policy.state.${row.state}`);
    button.disabled = row.state === "no_room" || row.state === "no_house";
    button.addEventListener("click", () => {
      if (!this.source) return;
      this.source.change(row.policy, !row.on);
      this.render();
    });
    item.append(name, gain, cost, money, button);
    return item;
  });
  list.replaceChildren(...rows);
};

PolicyWindow.prototype.open = function(this: PolicyWindowThis): void {
  this.render();
  this._toggleDisplay();
};

PolicyWindow.prototype.close = function(this: PolicyWindowThis): void {
  this._toggleDisplay();
  this._emitEvent(POLICY_WINDOW_CLOSED);
};
