/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the inspector's cards show of the register (docs/GAME_DESIGN.md 20.4): a home's households and their members, a
// workplace's people and their pay, and a person's own card. Lines are i18n keys with their values, as the rest of the
// card's (src/inspect.ts); names are the people's own, in both scripts, which the card shows in the player's language.
// Plain code: no DOM.

import type { Fact } from "../objects/cityObject";
import { CityRegister, type HomeEntry, type Person, type Workplace } from "./cityRegister";
import type { Name } from "./names";

/** One person in a card's list: their name, and a line about them; a click opens their card */
export interface RosterRow {
  id: string;
  name: Name;
  line: { key: string; params: Record<string, string | number> };
}

/** A list of people under a heading (a household, a workplace's staff) */
export interface RosterSection {
  heading: { key: string; params: Record<string, string | number> };
  /** A surname the heading takes as {surname}, in the player's language */
  surname?: Name;
  rows: RosterRow[];
  /** People of the list not shown */
  more: number;
  /** A line under the list (the jobs people from outside the city work) */
  note?: { key: string; params: Record<string, string | number> };
}

/** A person's card: who it is, where they live and work (tiles, for the buttons that go there) */
export interface PersonCard {
  id: string;
  name: Name;
  /** Their home: its object's id and tile */
  homeId: number;
  home: { x: number; y: number };
  /** Their workplace: an object's id (a square of fields has none), and its tile */
  work: { id: number | null; x: number; y: number } | null;
}

/** The most people a card lists under one heading */
export const ROSTER_MOST = 12;

/** The words of a role or job, as an i18n key */
export function roleKey(person: Person): string {
  return person.job ? `register.job.${person.job}` : `register.role.${person.role}`;
}

/** The i18n key of a vehicle's name (an era vehicle id, era3/pickup → register.vehicle.era3_pickup) */
export const vehicleKey = (id: string): string => `register.vehicle.${id.replace("/", "_")}`;

function row(person: Person): RosterRow {
  const key = person.income > 0 && person.role !== "retired" ? "register.row.paid" : "register.row";
  return { id: person.id, name: { th: CityRegister.nameOf(person, "th"), en: CityRegister.nameOf(person, "en") },
    line: { key, params: { age: person.member.age, role: roleKey(person), income: person.income } } };
}

/** The most households a home's card lists */
export const HOUSEHOLDS_MOST = 6;

/** A home's households, each with its members (the first HOUSEHOLDS_MOST, and a line for the rest) */
export function homeRoster(register: CityRegister, homeId: number): RosterSection[] {
  const home = register.home(homeId);
  if (!home) return [];
  const people = register.residents(homeId);
  const rest = home.households.slice(HOUSEHOLDS_MOST);
  const more: RosterSection[] = rest.length ? [{ heading: { key: "register.more_households",
    params: { households: rest.length, people: rest.reduce((n, h) => n + h.members.length, 0) } }, rows: [], more: 0 }] : [];
  return [...home.households.slice(0, HOUSEHOLDS_MOST).map((household) => {
    const members = people.filter((p) => p.household.index === household.index);
    return { heading: { key: "register.household", params: { people: members.length } }, surname: household.surname,
      rows: members.slice(0, ROSTER_MOST).map(row), more: Math.max(0, members.length - ROSTER_MOST) };
  }), ...more];
}

/** A workplace's people: how many of its jobs the city's people fill, and who they are */
export function workplaceRoster(register: CityRegister, id: number): RosterSection[] {
  const w = register.workplace(id);
  if (!w) return [];
  const outside = w.jobs - w.workers.length;
  return [{ heading: { key: "register.staff", params: { workers: w.workers.length, jobs: w.jobs } },
    rows: w.workers.slice(0, ROSTER_MOST).map(row), more: Math.max(0, w.workers.length - ROSTER_MOST),
    note: outside > 0 ? { key: "register.outside", params: { people: outside } } : undefined }];
}

/** What a workplace is called on a person's card: its title's i18n key, which src/inspect.ts gives for an object */
export type PlaceTitle = (w: Workplace) => string;

/** A person's card: their lines, their household, and where they live and work */
export function personCard(register: CityRegister, id: string, placeTitle: PlaceTitle,
  trip: { purpose: number; minutes: number } | null = null): {
  person: PersonCard; facts: Fact[]; people: RosterSection[];
} | null {
  const person = register.person(id);
  if (!person) return null;
  const { member, household, home } = person;
  const facts: Fact[] = [
    { key: member.male ? "register.fact.age_male" : "register.fact.age_female", params: { age: member.age } },
    { key: "register.fact.role", params: { role: roleKey(person) } },
  ];
  // On the road now, when the card came from a car or a walker clicked in the view
  if (trip) facts.push({ key: trip.purpose === 0 ? "register.fact.trip_work" : "register.fact.trip_shop",
    params: { minutes: Math.max(1, Math.round(trip.minutes)) } });
  if (person.workplace) {
    facts.push({ key: "register.fact.workplace", params: { place: placeTitle(person.workplace) } });
    facts.push(person.commuteM < 1000
      ? { key: "register.fact.commute_m", params: { minutes: CityRegister.commuteMinutes(person), metres: Math.round(person.commuteM / 10) * 10 } }
      : { key: "register.fact.commute", params: { minutes: CityRegister.commuteMinutes(person), km: Math.round(person.commuteM / 100) / 10 } });
  }
  if (person.income > 0) facts.push({ key: "register.fact.income", params: { income: person.income } });
  const money = register.moneyOf(home, household);
  facts.push({ key: "register.fact.household_income", params: { income: money.income, living: money.living } });
  facts.push({ key: "register.fact.savings", params: { savings: money.savings } });
  facts.push({ key: money.debt > 0 ? "register.fact.debt" : "register.fact.no_debt", params: { debt: money.debt } });
  if (money.vehicles.length) for (const v of money.vehicles) facts.push({ key: "register.fact.vehicle", params: { vehicle: vehicleKey(v) } });
  else facts.push({ key: "register.fact.no_vehicle" });
  const others = register.residents(home.id).filter((p) => p.household === household && p !== person);
  const people: RosterSection[] = others.length ? [{ heading: { key: "register.family", params: { people: others.length } },
    rows: others.slice(0, ROSTER_MOST).map(row), more: Math.max(0, others.length - ROSTER_MOST) }] : [];
  return {
    person: { id, name: { th: CityRegister.nameOf(person, "th"), en: CityRegister.nameOf(person, "en") },
      homeId: home.id, home: { x: home.x, y: home.y }, work: person.workplace ? { id: person.workplace.id >= 0 ? person.workplace.id : null,
        x: person.workplace.x, y: person.workplace.y } : null },
    facts, people,
  };
}

/** The home a person lives in, for the camera */
export function homeOf(register: CityRegister, id: string): HomeEntry | null {
  return register.person(id)?.home ?? null;
}
