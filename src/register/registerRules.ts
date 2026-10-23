/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The numbers of the city's register (ทะเบียนเมือง, docs/GAME_DESIGN.md section 20), one place for the owner to tune
// them: what households look like, what each job pays in each era, what living costs, how many work in each of the
// ruler's buildings, and what a household drives. People's money is everyday baht a month, not the treasury's scale
// (the treasury's baht are the game's own, a few satang of tax a person a year: docs/TAXES.md). Plain data: no DOM.

/** The ages a person is counted by in the register */
export const AGE_BANDS = ["child", "school", "young", "adult", "elder"] as const;
export type AgeBand = typeof AGE_BANDS[number];

/** The age band of an age: under 6, 6–17 (school age), 18–22, 23–59, 60 and over */
export function ageBand(age: number): AgeBand {
  return age < 6 ? "child" : age < 18 ? "school" : age < 23 ? "young" : age < 60 ? "adult" : "elder";
}

/** What a person does: a worker, out of work, keeping the house, at school or college, a small child at home, a child
 * of school age with no seat, retired */
export const ROLES = ["worker", "unemployed", "homemaker", "pupil", "student", "infant", "no_school", "retired"] as const;
export type Role = typeof ROLES[number];

/** The kinds of household, with how often each comes and its members in order: the adults first (the head, then the
 * spouse), then the children, then the grandparents. A household's members are a prefix of its kind's list, so a home
 * that holds more people adds them at the end and never changes those there. */
export const HOUSEHOLD_KINDS = [
  { kind: "single", weight: 0.14, adults: [1, 1], children: [0, 0], elders: [0, 0] },
  { kind: "couple", weight: 0.16, adults: [2, 2], children: [0, 0], elders: [0, 0] },
  { kind: "family", weight: 0.42, adults: [2, 2], children: [1, 3], elders: [0, 0] },
  { kind: "parent", weight: 0.08, adults: [1, 1], children: [1, 2], elders: [0, 0] },
  { kind: "extended", weight: 0.14, adults: [2, 2], children: [1, 2], elders: [1, 2] },
  { kind: "elders", weight: 0.06, adults: [0, 0], children: [0, 0], elders: [1, 2] },
] as const;
export type HouseholdKind = typeof HOUSEHOLD_KINDS[number]["kind"];

/** Of the spouses of a family with a child under six, the share who keep the house rather than look for work */
export const HOMEMAKER_SHARE = 0.35;
/** Of the young (18–22), the most who are at college or university when the city's higher seats are all they need
 * (the share is this times the city's higher education level) */
export const STUDENT_SHARE = 0.6;
/** The farthest a person goes to work (metres along the roads): about the trips' 30 minutes (src/sim/trips.ts) */
export const WORK_REACH_M = 15000;
/** How fast a commute goes (km an hour), for the minutes a person's card shows */
export const COMMUTE_KMH = 30;

/** The jobs people do, each with its pay a month in the modern city (era 4) in baht */
export const JOB_PAY = {
  farmer: 7000, rice_farmer: 7000, orchard_farmer: 8000, field_farmer: 6500, fish_farmer: 7500, fisher: 8000,
  shop_owner: 16000, shop_staff: 10000, office_worker: 20000,
  factory_worker: 11000, technician: 17000, supervisor: 25000, engineer: 40000,
  teacher: 22000, principal: 42000, nurse: 20000, doctor: 70000,
  police: 19000, firefighter: 17000, power_worker: 19000, water_worker: 16000, clerk: 18000,
  waste_worker: 10000, rail_worker: 18000, miner: 14000, port_worker: 15000, airport_worker: 24000, stadium_worker: 12000,
} as const;
export type Job = keyof typeof JOB_PAY;

/** Pay in each era against the modern city's: a farming village's baht went further, a future city's further still */
export const ERA_PAY: Readonly<Record<number, number>> = { 1: 0.3, 2: 0.5, 3: 0.75, 4: 1, 5: 1.5 };
/** Pay by the workplace's level (1–5): a bigger shop or works pays a little more */
export const levelPay = (level: number): number => 0.85 + 0.075 * Math.max(1, Math.min(5, level));
/** How far one person's pay may lie from the job's (each way) */
export const PAY_SPREAD = 0.12;
/** The old-age allowance a month (เบี้ยยังชีพผู้สูงอายุ), by era */
export const ELDER_ALLOWANCE: Readonly<Record<number, number>> = { 1: 150, 2: 300, 3: 500, 4: 800, 5: 1500 };
/** What living costs a person a month, by era (a child half), times the land's grade round the home (0–3) */
export const LIVING: Readonly<Record<number, number>> = { 1: 1800, 2: 2800, 3: 4200, 4: 5500, 5: 8000 };
export const CHILD_LIVING = 0.5;
export const landLiving = (grade: number): number => 0.8 + 0.15 * Math.max(0, Math.min(3, grade));

/** Of a workplace's people, who does what: the first a shop's owner, then by every so many workers */
export const SHOP_OFFICE_FROM = { era: 4, level: 4 };
export const FACTORY_RANKS = { supervisor: 15, technician: 6, engineer: 25, engineerFrom: { era: 3, level: 3 } };
export const SCHOOL_RANKS = { principal: 30 };
export const HOSPITAL_RANKS = { doctor: 5 };

/**
 * The people who work in each of the ruler's buildings (which the census counts no jobs for): by its kind, and for the
 * civic 3 × 3s (the ruler's house, schools, hospitals) by what it is. Farms, harbours, mines and the rubbish buildings
 * have the jobs the census counts for them instead (src/farming.ts, src/mining.ts, src/waste.ts).
 */
export const STAFF: Readonly<Record<string, { staff: number; job: Job }>> = {
  ruler_house: { staff: 12, job: "clerk" },
  kindergarten: { staff: 10, job: "teacher" },
  primary_school: { staff: 24, job: "teacher" },
  secondary_school: { staff: 40, job: "teacher" },
  vocational_college: { staff: 45, job: "teacher" },
  university: { staff: 120, job: "teacher" },
  health_centre: { staff: 8, job: "nurse" },
  community_hospital: { staff: 40, job: "nurse" },
  provincial_hospital: { staff: 150, job: "nurse" },
  regional_hospital: { staff: 400, job: "nurse" },
  police: { staff: 20, job: "police" },
  fire: { staff: 16, job: "firefighter" },
  power_plant: { staff: 30, job: "power_worker" },
  water_works: { staff: 15, job: "water_worker" },
  water_tower: { staff: 1, job: "water_worker" },
  station: { staff: 25, job: "rail_worker" },
  port: { staff: 80, job: "port_worker" },
  airport: { staff: 150, job: "airport_worker" },
  stadium: { staff: 25, job: "stadium_worker" },
};
/** The job of the census's jobs in the community's other workplaces */
export const COUNTED_JOB: Readonly<Record<string, Job>> = {
  farm: "farmer", harbour: "fisher", mine: "miner", waste: "waste_worker",
};
/** ... and of a field of the farm zone, by what it grows (src/farmZone.ts) */
export const FIELD_JOB: Readonly<Record<string, Job>> = {
  paddy: "rice_farmer", field: "field_farmer", orchard: "orchard_farmer", pond: "fish_farmer",
};
/** Fields are counted together in squares this many tiles a side, one workplace each */
export const FIELD_BLOCK = 4;

/**
 * What a household drives, by era: three tiers, cheapest first, of the era vehicles (src/render3d/city/eraVehicles.ts
 * ids, art/vehicles). A household's first vehicle is of the tier its income reaches, a second one tier below. A farming
 * household of the first two eras takes a cart before anything else of its tier.
 */
export const VEHICLE_TIERS: Readonly<Record<number, readonly [readonly string[], readonly string[], readonly string[]]>> = {
  1: [["era1/bicycle"], ["era1/hand_cart", "era1/ox_cart"], ["era1/buffalo_cart"]],
  2: [["era1/bicycle"], ["era2/motorcycle", "era2/samlor"], ["era2/songthaew", "era2/truck"]],
  3: [["era2/motorcycle", "era1/bicycle"], ["era3/motorcycle_helmet", "era3/motorcycle_taxi", "era3/tuktuk"],
    ["era3/pickup", "era3/pickup_cage", "era2/songthaew"]],
  4: [["era3/motorcycle_helmet", "era4/scooter"], ["era4/hatchback", "era4/pickup"], ["era4/sedan", "era4/van", "era4/taxi"]],
  5: [["era5/ev_scooter", "era4/scooter"], ["era5/ev_pod", "era5/ev_car"], ["era5/ev_car", "era5/flying_taxi"]],
};
export const FARM_CARTS: Readonly<Record<number, string>> = { 1: "era1/ox_cart", 2: "era1/buffalo_cart" };
/** A household's income over its living that buys a vehicle of each tier: below the first, none */
export const VEHICLE_INCOME = [0.9, 1.6, 3] as const;
/** What a vehicle of each tier costs, in months of the era's factory pay, for the loan still owed on it */
export const VEHICLE_PRICE = [1, 5, 20] as const;
/** The months a vehicle's loan runs */
export const LOAN_MONTHS = 48;
/** Of a farming household's yearly income, about how much it owes (farm debt), at most */
export const FARM_DEBT = 0.5;
