/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's register (src/register/, docs/GAME_DESIGN.md 20): the same city has the same people, the homes hold the
// census's people, nobody works a job the city does not have, no household has two people of one name, and a home that
// grows only adds people.

import * as fs from "fs";
import { CityCore } from "../src/core/cityCore";
import { decodeMap } from "../src/cityStorage";
import { GameMap } from "../src/gameMap.js";
import { Storage } from "../src/storage.js";
import { CityRegister } from "../src/register/cityRegister";
import { fullHousehold, householdsOf } from "../src/register/households";
import { surname, SURNAMES } from "../src/register/names";
import { VEHICLE_TIERS, FARM_CARTS } from "../src/register/registerRules";
import { homeRoster, personCard, roleKey, vehicleKey, workplaceRoster } from "../src/register/registerCards";
import { hasKey } from "../src/i18n/index";

function open() {
  const save = JSON.parse(fs.readFileSync("test/fixtures/khonKaen-v5.json", "utf8"));
  save.map = decodeMap(save.mapRle);
  delete save.mapRle;
  if (save.version !== (Storage as any).CURRENT_VERSION) (Storage as any).transitionOldSave(save);
  return new CityCore({ map: new (GameMap as any)(save.width, save.height), saved: save });
}

function registerOf(core: CityCore): CityRegister {
  const sim = core.simulation as any;
  core.objects.scan(core.map, sim._cityTime);
  return new CityRegister({ map: core.map, objects: core.objects, blockMaps: sim.blockMaps, services: sim._serviceLevels,
    fields: sim._farming?.fields ?? null, cityTime: sim._cityTime,
    satisfaction: { blockMaps: sim.blockMaps, budget: sim.budget, valves: sim._valves, services: sim._serviceLevels } });
}

describe("the city's register", () => {
  const core = open();
  core.run(16 * 4);
  const register = registerOf(core);
  // The census of the next look over the map, which counts each plot before it grows (a cycle is 16 steps)
  const later = open();
  later.run(16 * 5);
  const census = { ...(later.simulation as any)._census };

  test("the homes hold the census's people", () => {
    expect(register.counts.people).toBeGreaterThan(500);
    // (a plot formed or bulldozed during the look is counted by one and not the other: a plot or two of 20 people)
    expect(Math.abs(register.counts.people - census.resPop * 20)).toBeLessThanOrEqual(40);
    const byBand = Object.values(register.counts.bands).reduce((a, b) => a + b, 0);
    const byRole = Object.values(register.counts.roles).reduce((a, b) => a + b, 0);
    expect(byBand).toBe(register.counts.people);
    expect(byRole).toBe(register.counts.people);
    expect(register.counts.households).toBe(register.homes.reduce((n, h) => n + h.households.length, 0));
  });

  test("nobody works a job the city does not have, and every worker has a workplace and pay", () => {
    for (const w of register.workplaces) expect(w.workers.length).toBeLessThanOrEqual(w.jobs);
    expect(register.counts.filled).toBeLessThanOrEqual(register.counts.jobs);
    const workers = register.people.filter((p) => p.role === "worker");
    expect(workers.length).toBe(register.counts.filled);
    expect(workers.length).toBeGreaterThan(0);
    for (const p of workers) {
      expect(p.workplace).not.toBeNull();
      expect(p.income).toBeGreaterThan(0);
      expect(p.band === "young" || p.band === "adult").toBe(true);
    }
    // the city's jobs are the census's, and the staff of the ruler's buildings on top
    const counted = register.workplaces.filter((w) => ["shop", "factory", "farm", "harbour", "mine", "waste"].includes(w.kind))
      .reduce((n, w) => n + w.jobs, 0);
    expect(Math.abs(counted - (census.comPop + census.indPop) * 160)).toBeLessThanOrEqual(40);
    // ... and the farm zone's fields' work, a square of fields one workplace (each rounded)
    const fields = register.workplaces.filter((w) => w.kind === "fields");
    expect(Math.abs(fields.reduce((n, w) => n + w.jobs, 0) - (census.farmPop ?? 0) * 160)).toBeLessThanOrEqual(fields.length + 40);
  });

  test("no household has two people of one name", () => {
    for (const home of register.homes) for (const household of home.households) {
      const names = household.members.map((m) => m.given.th);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  test("the same city has the same people, every time it is opened", () => {
    const again = open();
    again.run(16 * 4);
    const second = registerOf(again);
    expect(second.people.length).toBe(register.people.length);
    for (let i = 0; i < register.people.length; i += 37) {
      const a = register.people[i], b = second.people[i];
      expect(b.id).toBe(a.id);
      expect(CityRegister.nameOf(b, "th")).toBe(CityRegister.nameOf(a, "th"));
      expect(b.member.age).toBe(a.member.age);
      expect(b.workplace?.id).toBe(a.workplace?.id);
      expect(b.income).toBe(a.income);
    }
    expect(second.counts).toEqual(register.counts);
  });

  test("each person can be looked up and found by name; each household has its money and vehicles", () => {
    const someone = register.people[Math.floor(register.people.length / 2)];
    expect(register.person(someone.id)).toBe(someone);
    expect(register.search(someone.member.given.th).map((p) => p.id)).toContain(someone.id);
    expect(register.search(someone.household.surname.en.toLowerCase().slice(0, 6)).length).toBeGreaterThan(0);
    expect(register.residents(someone.home.id)).toContain(someone);
    const money = register.moneyOf(someone.home, someone.household);
    expect(money.savings).toBeGreaterThanOrEqual(0);
    expect(money.debt).toBeGreaterThanOrEqual(0);
    expect(register.moneyOf(someone.home, someone.household)).toBe(money);
    const vehicles = Object.values(register.counts.vehicles).reduce((a, b) => a + b, 0);
    expect(vehicles).toBeGreaterThan(0);
  });
});

describe("the register in the cards", () => {
  const core = open();
  core.run(16 * 4);
  const register = registerOf(core);

  test("every workplace takes its share of the city's people before any takes more", () => {
    const share = register.counts.filled / register.counts.jobs;
    expect(share).toBeLessThan(1);
    // (all but a few: a workplace out of everyone's reach, about 30 minutes, gets nobody)
    const short = register.workplaces.filter((w) => w.workers.length < Math.floor(w.jobs * share) - 1);
    expect(short.length).toBeLessThanOrEqual(register.workplaces.length * 0.05);
  });

  test("a home lists its households, a workplace its people, a person their own lines, all translated", () => {
    const home = register.homes.find((h) => h.households.length > 1)!;
    const sections = homeRoster(register, home.id);
    expect(sections.length).toBe(Math.min(home.households.length, 6) + (home.households.length > 6 ? 1 : 0));
    const keys: string[] = [];
    for (const section of sections) {
      keys.push(section.heading.key);
      for (const row of section.rows) { keys.push(row.line.key, String(row.line.params.role)); expect(row.name.th).toMatch(/^(นาย|นาง|เด็ก)/); }
    }
    const busy = register.workplaces.find((w) => w.workers.length > 0)!;
    for (const section of workplaceRoster(register, busy.id)) keys.push(section.heading.key, ...(section.note ? [section.note.key] : []));
    const worker = busy.workers[0];
    const card = personCard(register, worker.id, () => "object.kind.shop")!;
    expect(card.person.name.en).toMatch(/^(Mr|Mrs|Miss) /);
    expect(card.person.work).not.toBeNull();
    for (const fact of card.facts) {
      keys.push(fact.key);
      for (const value of Object.values(fact.params ?? {})) if (typeof value === "string") keys.push(value);
    }
    for (const p of register.people) keys.push(roleKey(p));
    for (const id of Object.keys(register.counts.vehicles)) keys.push(vehicleKey(id));
    for (const key of new Set(keys)) expect([key, hasKey(key)]).toEqual([key, true]);
  });
});

describe("travellers on the road", () => {
  test("a car or walker of a trip is always the same person of a home on its first road, a worker going to work", () => {
    const core = open();
    core.run(16 * 4);
    const register = registerOf(core), map = core.map as any;
    const routes = map.trips?.result.routes ?? [];
    expect(routes.length).toBeGreaterThan(0);
    let found = 0;
    routes.slice(0, 40).forEach((route: any, r: number) => {
      for (let k = 0; k < 5; k++) {
        const person = register.traveller(r, k);
        if (!person) continue;
        found++;
        expect(register.traveller(r, k)).toBe(person);
        if (route.purpose === 0) expect(person.role).toBe("worker");
        else expect(["young", "adult", "elder"]).toContain(person.band);
      }
    });
    expect(found).toBeGreaterThan(0);
    expect(register.traveller(routes.length + 5, 0)).toBeNull();
  });
});

describe("households", () => {
  test("a home that grows adds people at the end and never renames those there", () => {
    const key = 123456789;
    const small = householdsOf(key, 7).flatMap((h) => h.members.map((m) => `${h.surname.th}:${m.given.th}:${m.age}`));
    const big = householdsOf(key, 23).flatMap((h) => h.members.map((m) => `${h.surname.th}:${m.given.th}:${m.age}`));
    expect(small.length).toBe(7);
    expect(big.length).toBe(23);
    expect(big.slice(0, 7)).toEqual(small);
  });

  test("titles go by sex, age and marriage; children are younger than their parents", () => {
    for (let h = 0; h < 400; h++) {
      const household = fullHousehold(987, h);
      const head = household.members[0];
      for (const m of household.members) {
        if (m.age < 15) expect(["เด็กชาย", "เด็กหญิง"]).toContain(m.title.th);
        else if (m.male) expect(m.title.th).toBe("นาย");
        else expect(m.title.th).toBe(m.married ? "นาง" : "นางสาว");
        if (m.relation === "child") expect(m.age).toBeLessThan(head.age - 15);
      }
    }
  });

  test("surnames are made of three parts, in Thai and romanised", () => {
    const seen = new Set<string>();
    for (let n = 0; n < SURNAMES; n += 7) seen.add(surname(n).th);
    expect(seen.size).toBe(Math.ceil(SURNAMES / 7));
    expect(surname(0)).toEqual({ th: "แก้วภูวงศ์", en: "Kaeophuwong" });
  });

  test("every vehicle a household drives is one of the era vehicles", () => {
    const index = JSON.parse(fs.readFileSync("assets/models/vehicles/index.json", "utf8")).vehicles;
    const ids = [...Object.values(VEHICLE_TIERS).flat(2), ...Object.values(FARM_CARTS)];
    for (const id of ids) expect(index[id]).toBeDefined();
  });
});
