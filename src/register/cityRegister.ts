/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's register (ทะเบียนเมือง, docs/GAME_DESIGN.md section 20; owner, 23 Oct 2026: "รถหรือคนในเกมส์ จะมีทะเบียนด้วย
// ... ทุก object พอคลิก จะมีรายละเอียดของ object นั้นๆ"). Who lives in each home (src/register/households.ts), where each
// one works, what they earn, save and owe, and what each household drives, all worked out from the city as it stands
// and never saved:
//
// - **People** are the census's: each home holds the people the census counts for it (20 a level of a 16 m plot), in
//   households whose members come from the home's own number, the same every time.
// - **Work**: the jobs are the census's (shops, factories, farms, harbours, mines, the rubbish buildings, the farm
//   zone's fields) and the staff of the ruler's buildings (registerRules.ts STAFF). The working people go to the nearest
//   jobs by road, the nearest pairs of homes and jobs in the whole city first, within about 30 minutes, each workplace
//   first taking the same share of its jobs; whoever finds none is out of work, and jobs nobody of the city takes are
//   worked by people from outside it.
// - **Money and vehicles** by the job, its place's level and the city's era; savings and debt from what is left over
//   after living, the months the home has stood and how content it is.
//
// Built only when something asks (the register window, a card), kept until the month or the city changes, never by the
// simulation's month: the simulation is unchanged by it. It only reads the city. Plain code: no DOM.

import { Commercial } from "../commercial.js";
import { isSite } from "../construction";
import { mapEra } from "../era";
import { Industrial } from "../industrial.js";
import { MINE_SPECS, mineKindAt } from "../mining";
import { FARM_JOBS, HARBOUR_JOBS } from "../farming";
import type { Building } from "../objects/cityObject";
import { gradeAt, LAND_GRADES, type SatisfactionContext } from "../objects/satisfaction";
import { plotAccess } from "../plots";
import type { ServiceLevels } from "../services";
import { mix } from "../sim/agentRandom";
import type { CityTrips } from "../sim/cityTrips";
import { isCityTileSize } from "../units";
import { WASTE_SPECS, wasteKindAt } from "../waste";
import { HHTHR, LHTHR } from "../tileValues";
import { type Household, householdsOf, homeKey, type Member } from "./households";
import { fullName, type Name } from "./names";
import {
  type AgeBand, ageBand, CHILD_LIVING, COMMUTE_KMH, COUNTED_JOB, ELDER_ALLOWANCE, ERA_PAY, FACTORY_RANKS, FARM_CARTS,
  FARM_DEBT, FIELD_BLOCK, FIELD_JOB, HOMEMAKER_SHARE, HOSPITAL_RANKS, type Job, JOB_PAY, landLiving, levelPay, LIVING,
  LOAN_MONTHS, PAY_SPREAD, type Role, SCHOOL_RANKS, SHOP_OFFICE_FROM, STAFF, STUDENT_SHARE, VEHICLE_INCOME, VEHICLE_PRICE,
  VEHICLE_TIERS, WORK_REACH_M,
} from "./registerRules";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Legacy = any;

/** People a level of a 16 m plot, as the census counts them (src/evaluation.js: a home unit is 20 people) */
export const PEOPLE_A_UNIT = 20;
/** A job unit of a shop or factory zone is eight home units (src/evaluation.js) */
export const JOBS_A_UNIT = 160;

export interface RegisterInput {
  map: Legacy;
  objects: { all(): Building[] };
  /** The simulation's block maps, for the land round each home */
  blockMaps?: Legacy;
  /** The month's schooling (src/services.ts): who is at school */
  services?: ServiceLevels | null;
  /** The farm zone's fields as the last scan found them (src/farmZone.ts Fields) */
  fields?: { found: ReadonlyArray<{ index: number; level: number; kind: string; share: number }>;
    spec: { kinds: Readonly<Record<string, { jobs: number }>> } } | null;
  /** The city's time (48 a year), for how long a home has stood */
  cityTime: number;
  /** What the satisfaction scores read, for how content a household is */
  satisfaction?: SatisfactionContext | null;
}

/** A place people work, with its jobs and the people of the city who work there */
export interface Workplace {
  /** The object's id, or for a square of fields a negative number */
  id: number;
  /** The object's kind ("shop", "civic" …) or "fields" */
  kind: string;
  /** What sort of its kind it is (a primary school, a paddy …) or "" */
  sort: string;
  x: number;
  y: number;
  level: number;
  jobs: number;
  job: Job;
  workers: Person[];
}

export interface HomeEntry {
  /** The home object's id */
  id: number;
  x: number;
  y: number;
  people: number;
  key: number;
  /** When it was formed or went up (city time) */
  born: number;
  households: Household[];
  /** Its land's grade round it (0–3) */
  land: number;
}

/** One person of the register */
export interface Person {
  /** home id . household . member, as text */
  id: string;
  home: HomeEntry;
  household: Household;
  member: Member;
  band: AgeBand;
  role: Role;
  workplace: Workplace | null;
  job: Job | null;
  /** Their own money a month, baht */
  income: number;
  /** How far they go to work (metres by road), 0 when they do not */
  commuteM: number;
}

export interface Money { income: number; living: number; savings: number; debt: number; vehicles: string[] }

export interface RegisterCounts {
  homes: number; shops: number; factories: number; farms: number; fields: number; services: number;
  households: number; people: number;
  bands: Record<AgeBand, number>;
  roles: Record<Role, number>;
  jobs: number; filled: number; outside: number;
  vehicles: Record<string, number>;
}

/** How many people the census counts for a home (src/plots.ts plotFound, src/plotBuildings.ts growPlot,
 * src/residential.js): 20 a level of a 16 m plot's ground, a zone's 3 × 3 by its size, a house 20 */
export function homePeopleOf(home: Building & Legacy, map: Legacy): number {
  const level = home.level?.(map) ?? 0;
  if (home.plot !== null && home.plot !== undefined) return Math.round(PEOPLE_A_UNIT * level * (home.share ?? 1));
  if (home.size === 1) {
    const value = map.getTileValue(home.x, home.y);
    return value >= LHTHR && value <= HHTHR ? PEOPLE_A_UNIT : PEOPLE_A_UNIT * Math.max(1, level);
  }
  return level >= 2 ? ((level - 1) * 8 + 16) * PEOPLE_A_UNIT : 0;
}

/** The census's jobs of a shop or factory: a level of a 16 m plot's ground is 20, a zone's by its size */
export function zoneJobsOf(place: Building & Legacy, map: Legacy): number {
  if (place.plot !== null && place.plot !== undefined) return Math.round(PEOPLE_A_UNIT * place.level(map) * (place.share ?? 1));
  if (place.size === 1) return PEOPLE_A_UNIT * Math.max(1, place.level(map));
  const value = map.getTileValue(place.x, place.y);
  const units = place.kind === "shop" ? Commercial.getZonePopulation(map, place.x, place.y, value)
    : Industrial.getZonePopulation(map, place.x, place.y, value);
  return units * JOBS_A_UNIT;
}

/** A workplace of the ruler's or the community's other buildings: its jobs and the job they do, or null for none */
function otherJobs(b: Building, map: Legacy): { jobs: number; job: Job; sort: string } | null {
  const sort = b.sort(map);
  if (b.kind in COUNTED_JOB) {
    const units = b.kind === "farm" ? FARM_JOBS : b.kind === "harbour" ? HARBOUR_JOBS
      : b.kind === "mine" ? MINE_SPECS[mineKindAt(map.mineKinds, b.id)].jobs : WASTE_SPECS[wasteKindAt(map.wasteKinds, b.id)].jobs;
    return units > 0 ? { jobs: units * JOBS_A_UNIT, job: COUNTED_JOB[b.kind], sort } : null;
  }
  const staff = STAFF[b.kind === "civic" ? sort : b.kind];
  return staff ? { jobs: staff.staff, job: staff.job, sort } : null;
}

/** A number in [0, 1) from a person's own and a purpose */
const unit = (u: number, salt: number): number => mix(Math.floor(u * 4294967296), salt) / 4294967296;

/** The city's own number, from what a map keeps that never changes: its size and its town */
export function citySalt(map: Legacy): number {
  const town = map.town ?? { x: 0, y: 0 };
  return mix(mix(map.width | 0, map.height | 0), mix(town.x | 0, town.y | 0));
}

/** A binary heap of (cost, node) pairs, for the roads' shortest ways */
class Heap {
  private cost: number[] = [];
  private node: number[] = [];
  get size(): number { return this.cost.length; }
  push(c: number, n: number): void {
    const cost = this.cost, node = this.node;
    let i = cost.length;
    cost.push(c); node.push(n);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (cost[p] <= c) break;
      cost[i] = cost[p]; node[i] = node[p]; i = p;
    }
    cost[i] = c; node[i] = n;
  }
  pop(): [number, number] {
    const cost = this.cost, node = this.node, top: [number, number] = [cost[0], node[0]];
    const lc = cost.pop()!, ln = node.pop()!;
    if (cost.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mc = lc;
        if (l < cost.length && cost[l] < mc) { m = l; mc = cost[l]; }
        if (r < cost.length && cost[r] < mc) { m = r; mc = cost[r]; }
        if (m === i) break;
        cost[i] = cost[m]; node[i] = node[m]; i = m;
      }
      cost[i] = lc; node[i] = ln;
    }
    return top;
  }
}

interface Access { k: number; t: number }

export class CityRegister {
  readonly homes: HomeEntry[] = [];
  readonly workplaces: Workplace[] = [];
  readonly people: Person[] = [];
  readonly counts: RegisterCounts;
  readonly era: number;
  private readonly byPerson = new Map<string, Person>();
  private readonly byHome = new Map<number, HomeEntry>();
  private readonly byWorkplace = new Map<number, Workplace>();
  private readonly money = new Map<string, Money>();
  private readonly homeObjects = new Map<number, Building>();
  /** The homes on each road of the month's trips (segment index), made the first time a traveller is asked for */
  private homesByRoad: Map<number, HomeEntry[]> | null = null;

  constructor(private readonly input: RegisterInput) {
    const { map } = input;
    this.era = mapEra(map);
    const salt = citySalt(map);
    const born = new Map<number, number>();
    for (const plot of map.plotBuildings?.all?.() ?? []) born.set(plot.id, plot.born);
    const counts: RegisterCounts = {
      homes: 0, shops: 0, factories: 0, farms: 0, fields: 0, services: 0, households: 0, people: 0,
      bands: { child: 0, school: 0, young: 0, adult: 0, elder: 0 },
      roles: { worker: 0, unemployed: 0, homemaker: 0, pupil: 0, student: 0, infant: 0, no_school: 0, retired: 0 },
      jobs: 0, filled: 0, outside: 0, vehicles: {},
    };
    this.counts = counts;
    // The homes and the workplaces, in the objects' order of ids (the same every time)
    const objects = [...input.objects.all()].sort((a, b) => a.id - b.id);
    for (const b of objects) {
      const any = b as Building & Legacy;
      if (b.kind === "home") {
        counts.homes++;
        const people = homePeopleOf(any, map);
        if (people <= 0) continue;
        const when = any.plot != null ? born.get(any.plot) ?? b.built : b.built;
        const key = homeKey(salt, b.id, when);
        const land = gradeAt(input.blockMaps?.landValueMap, b.x, b.y, LAND_GRADES);
        const home: HomeEntry = { id: b.id, x: b.x, y: b.y, people, key, born: when, households: householdsOf(key, people), land };
        this.homes.push(home);
        this.byHome.set(b.id, home);
        this.homeObjects.set(b.id, b);
        continue;
      }
      if (b.kind === "shop" || b.kind === "factory") {
        if (b.kind === "shop") counts.shops++; else counts.factories++;
        const jobs = zoneJobsOf(any, map);
        if (jobs > 0) this.addWorkplace({ id: b.id, kind: b.kind, sort: "", x: b.x, y: b.y, level: any.level(map),
          jobs, job: b.kind === "shop" ? "shop_staff" : "factory_worker", workers: [] });
        continue;
      }
      if (b.kind === "farm" || b.kind === "harbour") counts.farms++;
      else if (b.sector === "central") counts.services++;
      if (isSite(map, b.id)) continue;
      const other = otherJobs(b, map);
      if (other) this.addWorkplace({ id: b.id, kind: b.kind, sort: other.sort, x: b.x, y: b.y, level: 1, jobs: other.jobs,
        job: other.job, workers: [] });
    }
    // ... and the farm zone's fields, a square of them one workplace
    if (input.fields) {
      const blocks = new Map<number, { jobs: number; kinds: Record<string, number>; x: number; y: number; level: number }>();
      const across = Math.ceil(map.width / FIELD_BLOCK);
      for (const field of input.fields.found) {
        const x = field.index % map.width, y = Math.floor(field.index / map.width);
        const b = Math.floor(y / FIELD_BLOCK) * across + Math.floor(x / FIELD_BLOCK);
        const jobs = field.level * (input.fields.spec.kinds[field.kind]?.jobs ?? 0) * field.share * JOBS_A_UNIT;
        const block = blocks.get(b) ?? { jobs: 0, kinds: {}, x, y, level: 0 };
        block.jobs += jobs;
        block.kinds[field.kind] = (block.kinds[field.kind] ?? 0) + jobs;
        block.level = Math.max(block.level, field.level);
        blocks.set(b, block);
      }
      for (const [b, block] of [...blocks.entries()].sort((p, q) => p[0] - q[0])) {
        const jobs = Math.round(block.jobs);
        if (jobs <= 0) continue;
        counts.fields++;
        const kind = Object.entries(block.kinds).sort((p, q) => q[1] - p[1] || (p[0] < q[0] ? -1 : 1))[0][0];
        this.addWorkplace({ id: -1 - b, kind: "fields", sort: kind, x: block.x, y: block.y, level: block.level, jobs,
          job: FIELD_JOB[kind] ?? "farmer", workers: [] });
      }
    }
    // Everyone, with what they do before work is found
    // (a city just opened has no month's schooling yet, people 0: its children are taken to be at school)
    const services = input.services && input.services.people > 0 ? input.services : null;
    const basic = services ? services.basic / 100 : 1, higher = services ? services.higher / 100 : 0;
    const labour = new Map<number, Person[]>();
    for (const home of this.homes) {
      const looking: Person[] = [];
      for (const household of home.households) {
        counts.households++;
        const littleOne = household.members.some((m) => m.relation === "child" && m.age < 6);
        for (const member of household.members) {
          const band = ageBand(member.age);
          let role: Role;
          if (band === "child") role = "infant";
          else if (band === "school") role = member.u < basic ? "pupil" : "no_school";
          else if (band === "elder") role = "retired";
          else if (band === "young" && member.relation === "child" && member.u < STUDENT_SHARE * higher) role = "student";
          else if (member.relation === "spouse" && littleOne && unit(member.u, 1) < HOMEMAKER_SHARE) role = "homemaker";
          else role = "unemployed";
          const person: Person = { id: `${home.id}.${household.index}.${member.slot}`, home, household, member, band, role,
            workplace: null, job: null, income: 0, commuteM: 0 };
          if (role === "unemployed") looking.push(person);
          this.people.push(person);
          this.byPerson.set(person.id, person);
          counts.people++;
          counts.bands[band]++;
        }
      }
      if (looking.length) labour.set(home.id, looking);
    }
    this.findWork(labour);
    // Pay, and what each household drives
    for (const person of this.people) {
      if (person.role === "retired") person.income = Math.round(ELDER_ALLOWANCE[this.era] ?? 0);
      counts.roles[person.role]++;
    }
    for (const w of this.workplaces) { counts.jobs += w.jobs; counts.filled += w.workers.length; }
    counts.outside = counts.jobs - counts.filled;
    for (const home of this.homes) for (const household of home.households) {
      for (const id of this.vehiclesOf(home, household)) counts.vehicles[id] = (counts.vehicles[id] ?? 0) + 1;
    }
  }

  private addWorkplace(w: Workplace): void {
    this.workplaces.push(w);
    this.byWorkplace.set(w.id, w);
  }

  /** Where each working person works: the nearest pairs of homes and jobs in the whole city first, a fair share each */
  private findWork(labour: Map<number, Person[]>): void {
    const { map } = this.input;
    const trips: CityTrips | null = isCityTileSize(map.tileSizeM) ? map.trips ?? null : null;
    const size = map.tileSizeM || 16, reach = isCityTileSize(map.tileSizeM) ? WORK_REACH_M : Infinity;
    const access = (x: number, y: number): Access | null => {
      if (!trips) return null;
      const a = plotAccess(map, x, y);
      const k = a ? trips.roads.segmentIndex.get(a.segment) : undefined;
      return k === undefined || !a ? null : { k, t: a.t };
    };
    // The homes gathered by the road they reach (each group one search along the roads)
    const groups = new Map<number, { access: Access | null; homes: HomeEntry[]; x: number; y: number; supply: number }>();
    let loose = -1;
    for (const home of this.homes) {
      const looking = labour.get(home.id);
      if (!looking) continue;
      const a = access(home.x, home.y);
      const key = a ? a.k : loose--;
      const group = groups.get(key) ?? { access: a, homes: [], x: home.x, y: home.y, supply: 0 };
      group.homes.push(home);
      group.supply += looking.length;
      groups.set(key, group);
    }
    const places = this.workplaces.map((w) => ({ w, access: access(w.x, w.y), left: w.jobs }));
    const straight = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by) * size * 1.3;
    const net = trips?.net;
    const nodes = net ? net.offsets.length - 1 : 0;
    const dist = new Float64Array(nodes);
    const pairs: Array<{ g: number; p: number; d: number }> = [];
    const groupList = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
    groupList.forEach((group, g) => {
      const a = group.access;
      if (a && net) {
        dist.fill(Infinity);
        const heap = new Heap(), len = net.length[a.k];
        const start = (node: number, cost: number): void => { if (cost < dist[node]) { dist[node] = cost; heap.push(cost, node); } };
        start(net.segA[a.k], a.t * len);
        start(net.segB[a.k], (1 - a.t) * len);
        while (heap.size) {
          const [cost, node] = heap.pop();
          if (cost > dist[node] || cost > reach) continue;
          for (let e = net.offsets[node]; e < net.offsets[node + 1]; e++) {
            const next = net.wayTo[e], c = cost + net.length[net.waySegment[e]];
            if (c < dist[next]) { dist[next] = c; heap.push(c, next); }
          }
        }
      }
      places.forEach((place, p) => {
        let d: number;
        const b = place.access;
        if (a && b && net) {
          const lenB = net.length[b.k];
          d = a.k === b.k ? Math.abs(a.t - b.t) * lenB
            : Math.min(dist[net.segA[b.k]] + b.t * lenB, dist[net.segB[b.k]] + (1 - b.t) * lenB);
        } else d = straight(group.x, group.y, place.w.x, place.w.y);
        if (d <= reach) pairs.push({ g, p, d });
      });
    });
    pairs.sort((a, b) => a.d - b.d || a.g - b.g || a.p - b.p);
    const given: Array<Array<{ p: number; count: number; d: number }>> = groupList.map(() => []);
    const supply = groupList.map((group) => group.supply);
    // Where the city has more jobs than people to work them, each workplace first takes the same share of its jobs (the
    // nearest people first), so the works out of town are not left to outsiders while every shop in town is full; then
    // whoever is left takes what jobs are left, nearest first
    const jobs = places.reduce((n, place) => n + place.left, 0), people = supply.reduce((n, k) => n + k, 0);
    const share = jobs > 0 ? Math.min(1, people / jobs) : 0;
    const quota = places.map((place) => Math.floor(place.left * share));
    let spare = Math.min(people, jobs) - quota.reduce((n, q) => n + q, 0);
    const byRemainder = places.map((_, p) => p)
      .sort((a, b) => (places[b].left * share - quota[b]) - (places[a].left * share - quota[a]) || a - b);
    for (const p of byRemainder) { if (spare <= 0) break; if (quota[p] < places[p].left) { quota[p]++; spare--; } }
    const take = (room: number[]): void => {
      for (const pair of pairs) {
        if (!supply[pair.g] || !room[pair.p]) continue;
        const count = Math.min(supply[pair.g], room[pair.p]);
        supply[pair.g] -= count;
        room[pair.p] -= count;
        places[pair.p].left -= count;
        given[pair.g].push({ p: pair.p, count, d: pair.d });
      }
    };
    take(quota);
    take(places.map((place) => place.left));
    for (const list of given) list.sort((a, b) => a.d - b.d || a.p - b.p);
    // Each group's people, home by home, take its jobs nearest first
    groupList.forEach((group, g) => {
      const slots = given[g];
      let s = 0, used = 0;
      for (const home of group.homes) for (const person of labour.get(home.id) ?? []) {
        while (s < slots.length && used >= slots[s].count) { s++; used = 0; }
        if (s >= slots.length) return;
        used++;
        const w = places[slots[s].p].w;
        person.role = "worker";
        person.workplace = w;
        person.commuteM = Math.round(slots[s].d);
        w.workers.push(person);
      }
    });
    // ... and what each does there and earns
    for (const w of this.workplaces) w.workers.forEach((person, i) => {
      person.job = this.jobAt(w, i);
      const pay = JOB_PAY[person.job] * (ERA_PAY[this.era] ?? 1) * levelPay(w.level);
      person.income = Math.round(pay * (1 + PAY_SPREAD * (2 * unit(person.member.u, 2) - 1)) / 10) * 10;
    });
  }

  /** What the i-th of a workplace's people does there */
  private jobAt(w: Workplace, i: number): Job {
    const era = this.era;
    if (w.kind === "shop") {
      if (era >= SHOP_OFFICE_FROM.era && w.level >= SHOP_OFFICE_FROM.level) return "office_worker";
      return i === 0 ? "shop_owner" : "shop_staff";
    }
    if (w.kind === "factory") {
      const n = i + 1;
      if (era >= FACTORY_RANKS.engineerFrom.era && w.level >= FACTORY_RANKS.engineerFrom.level && n % FACTORY_RANKS.engineer === 0) return "engineer";
      if (n % FACTORY_RANKS.supervisor === 0) return "supervisor";
      if (n % FACTORY_RANKS.technician === 0) return "technician";
      return "factory_worker";
    }
    if (w.job === "teacher" && i % SCHOOL_RANKS.principal === 0) return "principal";
    if (w.job === "nurse" && w.sort !== "health_centre" && i % HOSPITAL_RANKS.doctor === 0) return "doctor";
    return w.job;
  }

  /** What a household drives: by its income over its living, one of the tier it reaches and one of the tier below */
  vehiclesOf(home: HomeEntry, household: Household): string[] {
    const income = this.householdIncome(household, home), living = this.householdLiving(household, home);
    const r = living > 0 ? income / living : 0;
    const tiers = VEHICLE_TIERS[this.era] ?? VEHICLE_TIERS[1];
    const top = r >= VEHICLE_INCOME[2] ? 2 : r >= VEHICLE_INCOME[1] ? 1 : r >= VEHICLE_INCOME[0] ? 0 : -1;
    const out: string[] = [];
    const farming = this.membersOf(home, household).some((p) => p.job !== null && /farmer$/.test(p.job));
    for (let tier = top, n = 0; tier >= 0 && n < 2; tier--, n++) {
      const list = tiers[tier];
      const cart = farming && n === 0 && tier >= 1 ? FARM_CARTS[this.era] : undefined;
      out.push(cart ?? list[Math.floor(unit(household.u, 10 + n) * list.length)]);
    }
    return out;
  }

  private membersOf(home: HomeEntry, household: Household): Person[] {
    return household.members.map((m) => this.byPerson.get(`${home.id}.${household.index}.${m.slot}`)!).filter(Boolean);
  }

  householdIncome(household: Household, home: HomeEntry): number {
    return this.membersOf(home, household).reduce((sum, p) => sum + p.income, 0);
  }

  householdLiving(household: Household, home: HomeEntry): number {
    const each = (LIVING[this.era] ?? LIVING[1]) * landLiving(home.land);
    return Math.round(household.members.reduce((sum, m) => sum + (m.age < 18 ? CHILD_LIVING : 1), 0) * each);
  }

  /** A household's money: what comes in and goes out a month, what it has put by and what it owes (baht) */
  moneyOf(home: HomeEntry, household: Household): Money {
    const id = `${home.id}.${household.index}`, known = this.money.get(id);
    if (known) return known;
    const income = this.householdIncome(household, home), living = this.householdLiving(household, home);
    const months = Math.max(3, Math.min(120, Math.floor((this.input.cityTime - home.born) / 4)));
    // How content it is (the home's satisfaction, 0–100), a half when not known
    const object = this.homeObjects.get(home.id);
    const score = object && this.input.satisfaction ? object.satisfaction(this.input.map, this.input.satisfaction)?.score ?? 50 : 50;
    const mood = score / 100, left = income - living;
    const thrift = 0.15 + 0.25 * unit(household.u, 20);
    let savings = left > 0 ? left * thrift * months * (0.6 + 0.8 * mood) : income * 0.3 * unit(household.u, 21);
    let debt = left < 0 ? -left * months * 0.6 : 0;
    const vehicles = this.vehiclesOf(home, household);
    const tiers = VEHICLE_TIERS[this.era] ?? VEHICLE_TIERS[1];
    const wage = JOB_PAY.factory_worker * (ERA_PAY[this.era] ?? 1);
    vehicles.forEach((id) => {
      const tier = tiers.findIndex((list) => list.includes(id));
      debt += Math.max(0, VEHICLE_PRICE[Math.max(0, tier)] * wage * (1 - months / LOAN_MONTHS));
    });
    if (this.membersOf(home, household).some((p) => p.job !== null && /farmer$/.test(p.job))) {
      debt += income * 12 * FARM_DEBT * unit(household.u, 22);
    }
    debt *= 1.3 - 0.6 * mood;
    savings = Math.round(savings / 100) * 100;
    debt = Math.round(debt / 100) * 100;
    const money = { income, living, savings, debt, vehicles };
    this.money.set(id, money);
    return money;
  }

  person(id: string): Person | null { return this.byPerson.get(id) ?? null; }

  /**
   * Who a car or a walker of the month's trips is (src/sim/trips.ts routes, drawn by the 3D view): the k-th, taken round,
   * of the people living on the route's first road who make that trip (to work: its workers going to work; shopping: its
   * grown-ups), in the order of their homes and households; the same person every time it is asked. Null for a route
   * that is not this month's, or a road with nobody of the city on it.
   */
  traveller(routeIndex: number, k: number): Person | null {
    const trips: CityTrips | null = this.input.map.trips ?? null;
    const route = trips?.result.routes[routeIndex];
    if (!trips || !route) return null;
    if (!this.homesByRoad) {
      this.homesByRoad = new Map();
      for (const home of this.homes) {
        const a = plotAccess(this.input.map, home.x, home.y);
        const segment = a ? trips.roads.segmentIndex.get(a.segment) : undefined;
        if (segment === undefined) continue;
        const list = this.homesByRoad.get(segment) ?? [];
        list.push(home);
        this.homesByRoad.set(segment, list);
      }
    }
    const going = (this.homesByRoad.get(route.fromSegment) ?? []).flatMap((home) => this.residents(home.id))
      .filter((p) => route.purpose === 0 ? p.role === "worker" : p.band === "adult" || p.band === "young" || p.band === "elder");
    return going.length ? going[((k % going.length) + going.length) % going.length] : null;
  }
  home(id: number): HomeEntry | null { return this.byHome.get(id) ?? null; }
  workplace(id: number): Workplace | null { return this.byWorkplace.get(id) ?? null; }
  /** The people of a home, household by household */
  residents(id: number): Person[] {
    const home = this.byHome.get(id);
    return home ? home.households.flatMap((h) => this.membersOf(home, h)) : [];
  }

  /** A person's whole name in a language */
  static nameOf(person: Person, language: "th" | "en"): string {
    return fullName(person.member.title, person.member.given, person.household.surname, language);
  }

  /** The people whose name has this in it (Thai or romanised, any case), at most `most` */
  search(text: string, most = 50): Person[] {
    const want = text.trim().toLowerCase();
    if (!want) return [];
    const out: Person[] = [];
    for (const person of this.people) {
      const { given } = person.member, family: Name = person.household.surname;
      if (given.th.includes(want) || family.th.includes(want) || given.en.toLowerCase().includes(want) ||
        family.en.toLowerCase().includes(want) || CityRegister.nameOf(person, "th").includes(want) ||
        CityRegister.nameOf(person, "en").toLowerCase().includes(want)) {
        out.push(person);
        if (out.length >= most) break;
      }
    }
    return out;
  }

  /** Minutes to work at the commute's pace */
  static commuteMinutes(person: Person): number {
    return Math.max(1, Math.round(person.commuteM / 1000 / COMMUTE_KMH * 60));
  }
}

let last: { map: unknown; key: string; register: CityRegister } | null = null;

/** The city's register as it stands: made when first asked, and again when the month or the city has changed */
export function registerOf(input: RegisterInput): CityRegister {
  const { map } = input;
  const key = [Math.floor(input.cityTime / 4), map.plotBuildings?.version ?? 0, input.objects.all().length, map.era ?? 0].join("|");
  if (last && last.map === map && last.key === key) return last.register;
  const register = new CityRegister(input);
  last = { map, key, register };
  return register;
}
