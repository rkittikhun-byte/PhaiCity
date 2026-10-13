/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The ruler's policies (นโยบายเจ้าเมือง, docs/POLICIES.md; owner, 13 Oct 2026, docs/TOOLS_PLAN.md item 4). The ruler
// switches policies on and off in the policies window, opened from the ruler's house's card; each brings something
// and costs something, and every one costs a yearly sum to run. A house of level n has room for ⌈n / 2⌉ of them and
// its council hall for one more. They work only while the house stands, and are forgotten with it.
// Switching is a command ({ type: "policy", policy, on }, src/cityCommands.ts). The simulation reads them each month
// (src/simulation.js). No DOM.

import { hasWing, houseStanding, type HouseMap, MAX_HOUSE_LEVEL } from "./rulerHouse";

export const POLICIES = ["no_field_burning", "water_saving", "fishing_closure", "green_zoning", "songkran_saving",
  "pollution_tax", "higher_tolls"] as const;
export type Policy = typeof POLICIES[number];

/** What each costs a year to run, in baht */
export const POLICY_UPKEEP: Readonly<Record<Policy, number>> = {
  no_field_burning: 100,
  water_saving: 80,
  fishing_closure: 60,
  green_zoning: 150,
  songkran_saving: 50,
  pollution_tax: 100,
  higher_tolls: 40,
};

/** No field burning: no stubble fires and no haze, but the farms sell this much of their crop (src/farming.ts) */
export const NO_BURNING_YIELD = 0.8;
/** Water saving: the water goes this much further (src/waterManager.ts), and homes are this much less wanted */
export const WATER_SAVING = 0.15;
export const WATER_SAVING_PULL = 0.03;
/** Fishing closure: in these months (0-based, February to April, when the fish spawn) the harbours neither fish nor sell */
export const CLOSED_MONTHS: readonly number[] = [1, 2, 3];
/** Green zoning: land value added everywhere, the rain fills the ground this much faster, and every zone is wanted this
 * much */
export const GREEN_LAND_VALUE = 10;
export const GREEN_RECHARGE = 1.3;
export const GREEN_DEMAND = 0.9;
/** Water-wise Songkran: the water fights use none of the supply, but this many of Songkran's visitors come */
export const SONGKRAN_VISITORS = 0.7;
/** Pollution tax: factory smoke this much of what it was, factories wanted this much, and baht a year for each unit of
 * the census's industrial population */
export const POLLUTION_TAX_SMOKE = 0.75;
export const POLLUTION_TAX_DEMAND = 0.9;
export const POLLUTION_TAX_RATE = 2;
/** Higher tolls: tollways take this many times as much (src/roadLevels.ts), and shops are wanted this much */
export const TOLL_RAISE = 1.5;
export const TOLL_SHOPS = 0.95;

/** Why a policy command was refused */
export const POLICY_NO_HOUSE = "the ruler's house must stand for policies";
export const NO_POLICY_SLOT = "no room for another policy";
export const POLICY_ON = "that policy is on";
export const POLICY_OFF = "that policy is off";

export interface PolicyMap extends HouseMap {
  /** The policies switched on, in the order they were (saved as policies) */
  policies?: Policy[];
}

export function isPolicy(value: unknown): value is Policy {
  return typeof value === "string" && (POLICIES as readonly string[]).includes(value);
}

/** Room for policies: ⌈level / 2⌉ for the house, one more with its council hall; none without a house. */
export function policySlots(map: HouseMap): number {
  if (!houseStanding(map) || !map.rulerHouse) return 0;
  const level = Math.max(1, Math.min(MAX_HOUSE_LEVEL, Math.round(map.rulerHouse.level)));
  return Math.ceil(level / 2) + (hasWing(map, "council_hall") ? 1 : 0);
}

/** The policies at work: those switched on, while the house stands, as many as it has room for. */
export function policiesInForce(map: PolicyMap): Policy[] {
  return (map.policies ?? []).slice(0, policySlots(map));
}

export function hasPolicy(map: PolicyMap, policy: Policy): boolean {
  return policiesInForce(map).includes(policy);
}

/** What the policies at work cost a year. */
export function policyUpkeep(map: PolicyMap): number {
  return policiesInForce(map).reduce((sum, policy) => sum + POLICY_UPKEEP[policy], 0);
}

/** Why a policy may not be switched on (on) or off now, or null. */
export function policyProblem(map: PolicyMap | undefined, policy: Policy, on: boolean): string | null {
  if (!map) return POLICY_NO_HOUSE;
  const policies = map.policies ?? [];
  if (!on) return policies.includes(policy) ? null : POLICY_OFF;
  if (!houseStanding(map)) return POLICY_NO_HOUSE;
  if (policies.includes(policy)) return POLICY_ON;
  return policiesInForce(map).length >= policySlots(map) ? NO_POLICY_SLOT : null;
}

/** Switches a policy that policyProblem allowed. */
export function changePolicy(map: PolicyMap, policy: Policy, on: boolean): void {
  const policies = map.policies ?? [];
  map.policies = on ? [...policies, policy] : policies.filter((p) => p !== policy);
}

/** Forgets the policies beyond the room there is, the last switched on first: when the council hall comes off. */
export function trimPolicies(map: PolicyMap): void {
  if (map.policies && map.policies.length > policySlots(map)) map.policies = map.policies.slice(0, policySlots(map));
}

/** A saved list of policies, keeping only known ones, once each. */
export function readPolicies(saved: unknown): Policy[] {
  if (!Array.isArray(saved)) return [];
  return saved.filter((policy, i): policy is Policy => isPolicy(policy) && saved.indexOf(policy) === i);
}

/** One policy's row in the policies window (src/policyWindow.ts), and what its button does now. */
export interface PolicyRow {
  policy: Policy;
  on: boolean;
  state: "on" | "off" | "no_room" | "no_house";
}

export function policyRows(map: PolicyMap): PolicyRow[] {
  const standing = houseStanding(map);
  const on = map.policies ?? [];
  const room = policiesInForce(map).length < policySlots(map);
  return POLICIES.map((policy) => {
    const isOn = on.includes(policy);
    const state: PolicyRow["state"] = isOn ? "on" : !standing ? "no_house" : room ? "off" : "no_room";
    return { policy, on: isOn, state };
  });
}
