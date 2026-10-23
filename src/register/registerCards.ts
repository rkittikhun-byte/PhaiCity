/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the inspector's cards show of the register (docs/GAME_DESIGN.md 21.4): a home's households and their members, a
// business's name and owner, a workplace's people and their pay, a person's own card, and the card of a vehicle on the
// road with its owner and plate. Lines are i18n keys with their values, as the rest of the card's (src/inspect.ts);
// names are the people's and businesses' own, in both scripts: a param written "@key" stands for the name `names[key]`,
// which the card shows in the player's language. Plain code: no DOM.

import type { Fact } from "../objects/cityObject";
import { CityRegister, type HomeEntry, type Person, type Traveller, type Workplace } from "./cityRegister";
import type { Name } from "./names";

type Params = Record<string, string | number>;

/** One person in a card's list: their name, and a line about them; a click opens their card */
export interface RosterRow {
  id: string;
  name: Name;
  line: { key: string; params: Params };
}

/** A list of people under a heading (a household, a business's owner, a workplace's staff) */
export interface RosterSection {
  heading: { key: string; params: Params };
  /** The names its params stand for ("@surname" …) */
  names?: Record<string, Name>;
  rows: RosterRow[];
  /** People of the list not shown */
  more: number;
  /** A line under the list (the jobs people from outside the city work) */
  note?: { key: string; params: Params };
}

/** A person's card: who it is, where they live and work (tiles and objects, for the buttons that go there) */
export interface PersonCard {
  id: string;
  name: Name;
  /** Their home: its object's id and tile */
  homeId: number;
  home: { x: number; y: number };
  /** Their workplace: an object's id (a square of fields has none), and its tile */
  work: { id: number | null; x: number; y: number } | null;
}

/** What a card of the register gives the inspector */
export interface RegisterCard {
  person?: PersonCard;
  /** A vehicle's card has a title of its own ("{vehicle}ของ{owner}") */
  title?: { key: string; params: Params };
  facts: Fact[];
  people: RosterSection[];
  names: Record<string, Name>;
}

/** The most people a card lists under one heading */
export const ROSTER_MOST = 12;

/** The words of a role or job, as an i18n key */
export function roleKey(person: Person): string {
  return person.job ? `register.job.${person.job}` : `register.role.${person.role}`;
}

/** The i18n key of a vehicle's name (an era vehicle id, era3/pickup → register.vehicle.era3_pickup) */
export const vehicleKey = (id: string): string => `register.vehicle.${id.replace("/", "_")}`;

const nameOf = (person: Person): Name => ({ th: CityRegister.nameOf(person, "th"), en: CityRegister.nameOf(person, "en") });

function row(person: Person): RosterRow {
  const key = person.income > 0 && person.role !== "retired" ? "register.row.paid" : "register.row";
  return { id: person.id, name: nameOf(person),
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
    return { heading: { key: "register.household", params: { people: members.length, surname: "@surname" } },
      names: { surname: household.surname }, rows: members.slice(0, ROSTER_MOST).map(row),
      more: Math.max(0, members.length - ROSTER_MOST) };
  }), ...more];
}

/** A workplace's people: a business's name and owner first, then how many of its jobs the city's people fill, and who */
export function workplaceRoster(register: CityRegister, id: number): RosterSection[] {
  const w = register.workplace(id);
  if (!w) return [];
  const outside = w.jobs - w.workers.length;
  const business: RosterSection[] = w.business ? [{ heading: { key: w.owner ? "register.business" : "register.business_outside",
    params: { business: "@business" } }, names: { business: w.business }, rows: w.owner ? [row(w.owner)] : [], more: 0 }] : [];
  const staff = w.business ? w.workers.slice(1) : w.workers;
  return [...business, { heading: { key: "register.staff", params: { workers: w.workers.length, jobs: w.jobs } },
    rows: staff.slice(0, ROSTER_MOST).map(row), more: Math.max(0, staff.length - ROSTER_MOST),
    note: outside > 0 ? { key: "register.outside", params: { people: outside } } : undefined }];
}

/** What a workplace is called on a card: its title's i18n key, which src/inspect.ts gives for an object */
export type PlaceTitle = (w: Workplace) => string;

/** A place's words for a line: a business's name ("@key", added to names), else its title's key */
function placeParam(w: Workplace, placeTitle: PlaceTitle, names: Record<string, Name>, key: string): string {
  if (w.business) { names[key] = w.business; return `@${key}`; }
  return placeTitle(w);
}

/** The line of a trip a person or a vehicle is on: why, where to, and how long (owner: every one on the move has where
 * they came from and where they are going) */
function tripFact(trip: Traveller, placeTitle: PlaceTitle, names: Record<string, Name>): Fact {
  const minutes = Math.max(1, Math.round(trip.minutes));
  const to = trip.destination;
  if (trip.purpose === 2) return { key: "register.fact.trip_school", params: { minutes } };
  if (!to) return { key: trip.purpose === 0 ? "register.fact.trip_work" : "register.fact.trip_shop", params: { minutes } };
  return { key: trip.purpose === 0 ? "register.fact.trip_work_at" : "register.fact.trip_shop_at",
    params: { minutes, place: placeParam(to, placeTitle, names, "to") } };
}

/** A person's card: their lines, their household, and where they live and work; trip: the trip they are on, when they
 * were clicked on the road */
export function personCard(register: CityRegister, id: string, placeTitle: PlaceTitle, trip: Traveller | null = null): RegisterCard | null {
  const person = register.person(id);
  if (!person) return null;
  const { member, household, home } = person;
  const names: Record<string, Name> = {};
  const facts: Fact[] = [
    { key: member.male ? "register.fact.age_male" : "register.fact.age_female", params: { age: member.age } },
    { key: "register.fact.role", params: { role: roleKey(person) } },
  ];
  if (trip) facts.push(tripFact(trip, placeTitle, names));
  if (person.workplace) {
    facts.push({ key: "register.fact.workplace", params: { place: placeParam(person.workplace, placeTitle, names, "work") } });
    facts.push(person.commuteM < 1000
      ? { key: "register.fact.commute_m", params: { minutes: CityRegister.commuteMinutes(person), metres: Math.round(person.commuteM / 10) * 10 } }
      : { key: "register.fact.commute", params: { minutes: CityRegister.commuteMinutes(person), km: Math.round(person.commuteM / 100) / 10 } });
  }
  if (person.income > 0) facts.push({ key: "register.fact.income", params: { income: person.income } });
  const money = register.moneyOf(home, household);
  facts.push({ key: "register.fact.household_income", params: { income: money.income, living: money.living } });
  facts.push({ key: "register.fact.savings", params: { savings: money.savings } });
  facts.push({ key: money.debt > 0 ? "register.fact.debt" : "register.fact.no_debt", params: { debt: money.debt } });
  money.vehicles.forEach((v, n) => {
    const plate = register.plateOf(household, n, v);
    facts.push(plate ? { key: "register.fact.vehicle_plate", params: { vehicle: vehicleKey(v), plate } }
      : { key: "register.fact.vehicle", params: { vehicle: vehicleKey(v) } });
  });
  if (!money.vehicles.length) facts.push({ key: "register.fact.no_vehicle" });
  const others = register.residents(home.id).filter((p) => p.household === household && p !== person);
  const people: RosterSection[] = others.length ? [{ heading: { key: "register.family", params: { people: others.length } },
    rows: others.slice(0, ROSTER_MOST).map(row), more: Math.max(0, others.length - ROSTER_MOST) }] : [];
  return {
    person: { id, name: nameOf(person), homeId: home.id, home: { x: home.x, y: home.y },
      work: person.workplace ? { id: person.workplace.id >= 0 ? person.workplace.id : null, x: person.workplace.x, y: person.workplace.y } : null },
    facts, people, names,
  };
}

/**
 * The card of a car clicked on the road (owner: "รถนาย เอ เจ้าของบริษัท xxx"): the household's vehicle its traveller drives
 * (the first with a plate, else the first), titled "{vehicle}ของ{owner}", with its plate, what its owner does and where,
 * and the trip it is on; the owner's name opens their card. A traveller whose household has no vehicle is on foot: their
 * own card instead.
 */
export function vehicleCard(register: CityRegister, trip: Traveller, placeTitle: PlaceTitle): RegisterCard | null {
  const { person } = trip;
  const money = register.moneyOf(person.home, person.household);
  const n = Math.max(0, money.vehicles.findIndex((v, i) => register.plateOf(person.household, i, v) !== null));
  const vehicle = money.vehicles[n];
  if (!vehicle) return personCard(register, person.id, placeTitle, trip);
  const names: Record<string, Name> = { owner: nameOf(person) };
  const plate = register.plateOf(person.household, n, vehicle);
  const facts: Fact[] = plate ? [{ key: "register.fact.plate", params: { plate } }] : [];
  facts.push(person.workplace
    ? { key: "register.fact.owner_works", params: { role: roleKey(person), place: placeParam(person.workplace, placeTitle, names, "work") } }
    : { key: "register.fact.role", params: { role: roleKey(person) } });
  facts.push(tripFact(trip, placeTitle, names));
  return { title: { key: "register.vehicle_card", params: { vehicle: vehicleKey(vehicle), owner: "@owner" } }, facts, names,
    people: [{ heading: { key: "register.owner", params: {} }, rows: [row(person)], more: 0 }] };
}

/** The card of a factory's lorry on the road, the k-th of its lorries: the business's, with its plate (owner: lorries going
 * to and from factories belong to the factory) */
export function lorryCard(register: CityRegister, workplaceId: number, k: number): RegisterCard | null {
  const w = register.workplace(workplaceId);
  if (!w || !w.business) return null;
  const { vehicle, plate } = register.lorryOf(w, k);
  const facts: Fact[] = plate ? [{ key: "register.fact.plate", params: { plate } }] : [];
  facts.push({ key: "register.fact.delivering", params: { business: "@business" } });
  return { title: { key: "register.vehicle_card", params: { vehicle: vehicleKey(vehicle), owner: "@business" } }, facts,
    names: { business: w.business }, people: w.owner ? [{ heading: { key: "register.owner", params: {} }, rows: [row(w.owner)], more: 0 }] : [] };
}

/** The home a person lives in, for the camera */
export function homeOf(register: CityRegister, id: string): HomeEntry | null {
  return register.person(id)?.home ?? null;
}
