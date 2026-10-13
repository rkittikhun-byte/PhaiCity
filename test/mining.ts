/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Mines and oil wells (docs/MINING.md): royalties and work, dust and poison, ore that runs out, spills, and the city
// running them.

import { CityCommands, NO_RESOURCE } from "../src/cityCommands";
import { GameMap } from "../src/gameMap.js";
import { GameTools } from "../src/gameTools.js";
import { hasKey } from "../src/i18n/index";
import * as Messages from "../src/messages";
import {
  canDig, cleanse, MINE_KINDS, MINE_MONTHS_PER_LEVEL, MINE_SPECS, MINE_TOOLS, mineKindAt, mineKindOfTool, mineLevel, Mining,
  miningMonth, mineValue, poison, startingReserves,
} from "../src/mining";
import { BASE_PRICES } from "../src/provinceRules";
import { Simulation } from "../src/simulation.js";
import { POWERBIT } from "../src/tileFlags";
import { MINE } from "../src/tileValues";

const never = () => 1;
const always = () => 0;

describe("mines", () => {
  test("are nine kinds, each dug by its own tool, with a price", () => {
    expect(MINE_KINDS.length).toBe(9);
    expect(mineKindOfTool("gold_mine")).toBe("gold");
    expect(mineKindOfTool("oil_well")).toBe("petroleum");
    expect(mineKindOfTool("road")).toBeNull();
    for (const kind of MINE_KINDS) expect(BASE_PRICES[MINE_TOOLS[kind] as keyof typeof BASE_PRICES]).toBeGreaterThan(0);
  });

  test("dig only the ore the province has; a practice map has a few kinds", () => {
    expect(canDig("gold", { gold: 3 })).toBe(true);
    expect(canDig("gold", { gold: 0, tin: 2 })).toBe(false);
    expect(mineLevel("tin", {})).toBe(2);
    expect(canDig("zinc", {})).toBe(false);
    expect(startingReserves({ gold: 3, tin: 0 })).toEqual({ gold: 3 * MINE_MONTHS_PER_LEVEL });
  });

  test("pay more for richer ore and dearer kinds", () => {
    expect(mineValue("gold", { gold: 5 })).toBeGreaterThan(mineValue("gold", { gold: 1 }));
    expect(mineValue("rareEarth", { rareEarth: 3 })).toBeGreaterThan(mineValue("limestone", { limestone: 3 }));
  });

  test("use up the province's ore, sooner with more mines, and say when it is gone", () => {
    const ground = new Uint8Array(20 * 20);
    const reserves = { zinc: 3 };
    const two = [{ x: 5, y: 5, kind: "zinc" as const }, { x: 14, y: 14, kind: "zinc" as const }];
    const first = miningMonth(two, { zinc: 2 }, reserves, ground, 20, 20, never);
    expect(first.income).toBe(2 * mineValue("zinc", { zinc: 2 }));
    expect(reserves.zinc).toBe(1);
    const second = miningMonth(two, { zinc: 2 }, reserves, ground, 20, 20, never);
    expect(second.exhausted.length).toBe(1);
    expect(reserves.zinc).toBe(0);
    expect(miningMonth(two, { zinc: 2 }, reserves, ground, 20, 20, never).income).toBe(0);
  });

  test("poison the ground around them, most at the mine, and it fades only slowly", () => {
    const ground = new Uint8Array(30 * 30);
    for (let month = 0; month < 12; month++) {
      miningMonth([{ x: 15, y: 15, kind: "gold" }], { gold: 3 }, { gold: 100 }, ground, 30, 30, never);
    }
    expect(ground[15 * 30 + 15]).toBeGreaterThan(200);
    expect(ground[15 * 30 + 19]).toBeLessThan(ground[15 * 30 + 15]);
    expect(ground[15 * 30 + 25]).toBe(0);
    const before = ground[15 * 30 + 15];
    for (let month = 0; month < 12; month++) cleanse(ground);
    expect(ground[15 * 30 + 15]).toBeLessThan(before);
    expect(ground[15 * 30 + 15]).toBeGreaterThan(before / 2); // years, not months
    const limestone = new Uint8Array(30 * 30);
    miningMonth([{ x: 15, y: 15, kind: "limestone" }], { limestone: 3 }, { limestone: 9 }, limestone, 30, 30, never);
    expect(Math.max(...limestone)).toBe(0); // dust, but no poison
  });

  test("oil wells spill now and then", () => {
    const ground = new Uint8Array(20 * 20);
    const calm = miningMonth([{ x: 10, y: 10, kind: "petroleum" }], { petroleum: 3 }, { petroleum: 9 }, ground, 20, 20, never);
    expect(calm.spills).toEqual([]);
    const spill = miningMonth([{ x: 10, y: 10, kind: "petroleum" }], { petroleum: 3 }, { petroleum: 9 }, ground, 20, 20, always);
    expect(spill.spills.length).toBe(1);
    expect(ground[10 * 20 + 10]).toBeGreaterThan(150);
  });

  test("the map's record says what each mine digs; one with none is limestone", () => {
    expect(mineKindAt({ 7: "gold" }, 7)).toBe("gold");
    expect(mineKindAt(null, 7)).toBe("limestone");
  });

  test("poisoned ground spoils the water pumped from it", () => {
    const mining = new Mining(10, 10, { gold: 3 });
    expect(mining.cleanWater(5, 5)).toBe(1);
    poison(mining.ground, 10, 10, 5, 5, 255, 2);
    expect(mining.cleanWater(5, 5)).toBeLessThan(0.6);
    mining.ground.fill(255);
    expect(mining.cleanWater(5, 5)).toBeCloseTo(0.2);
  });

  test("save what ore is left and the poison, and an older save starts with the province's ore", () => {
    const mining = new Mining(8, 8, { tin: 2 });
    mining.start({ tin: 2 });
    mining.reserves.tin = 7;
    mining.ground[3] = 99;
    const saved: Record<string, unknown> = {};
    mining.save(saved);
    const loaded = new Mining(8, 8);
    loaded.load(saved);
    loaded.start({ tin: 2 });
    expect(loaded.reserves).toEqual({ tin: 7 });
    expect(loaded.ground[3]).toBe(99);
    const old = new Mining(8, 8);
    old.load({});
    old.start({ tin: 2 });
    expect(old.reserves).toEqual({ tin: 2 * MINE_MONTHS_PER_LEVEL });
  });
});

describe("mines in the city", () => {
  const blank = () => new (GameMap as unknown as new (w: number, h: number) => any)(64, 40);

  function city(resources: Record<string, number>) {
    const map = blank();
    map.powerKinds = {};
    map.mineKinds = {};
    const sim: any = new (Simulation as any)(map, 0, 3, null, null, resources);
    const tools: any = new (GameTools as any)(map);
    sim.budget.setFunds(50000);
    const commands = new CityCommands({
      width: map.width, height: map.height, tools, get blockMaps() { return sim.blockMaps; }, budget: sim.budget,
      disasters: sim.disasterManager, sprites: sim.spriteManager, setSpeed: () => undefined, setAutoBulldoze: () => undefined,
      resources: sim.resources,
      setMineKind: (x: number, y: number, kind: string) => { map.mineKinds[y * map.width + x] = kind; },
    } as any);
    return { map, sim, commands };
  }

  test("a mine is refused where the province has none of its ore", () => {
    const { commands } = city({ gold: 0, tin: 2 });
    expect(commands.apply({ type: "tool", tool: "gold_mine", x: 10, y: 10 }).reason).toBe(NO_RESOURCE);
    expect(commands.apply({ type: "tool", tool: "tin_mine", x: 10, y: 10 }).toolResult).toBe(0);
  });

  test("a powered mine pays royalties into the year's taxes, gives work and poisons the ground", () => {
    const { map, sim, commands } = city({ zinc: 3 });
    expect(commands.apply({ type: "tool", tool: "zinc_mine", x: 20, y: 20 }).toolResult).toBe(0);
    expect(map.getTileValue(20, 20)).toBe(MINE);
    expect(map.mineKinds[20 * 64 + 20]).toBe("zinc");
    // A power plant beside it (its 4 x 4 on 15..18) passes power on
    expect(commands.apply({ type: "tool", tool: "coal", x: 16, y: 20 }).toolResult).toBe(0);
    const news: string[] = [];
    sim.addEventListener(Messages.FRONT_END_MESSAGE, (m: { subject: string }) => news.push(m.subject));
    for (let step = 0; step < 16 * 8; step++) sim._simulate(sim._constructSimData());
    expect(map.getTileFlags(20, 20) & POWERBIT).toBe(POWERBIT);
    expect(sim.budget.miningFund).toBeGreaterThan(0);
    expect(sim._census.mineCount).toBe(1);
    expect(sim._census.indPop).toBeGreaterThanOrEqual(MINE_SPECS.zinc.jobs);
    expect(sim._mining.ground[20 * 64 + 20]).toBeGreaterThan(0);
    expect(sim.blockMaps.toxicMap.worldGet(20, 20)).toBe(sim._mining.ground[20 * 64 + 20]);
    expect(news).toContain(Messages.TOXIC_GROUND);
    expect(sim._mining.reserves.zinc).toBeLessThan(3 * MINE_MONTHS_PER_LEVEL);
  });

  test("an unpowered mine does nothing", () => {
    const { sim, commands } = city({ tin: 3 });
    commands.apply({ type: "tool", tool: "tin_mine", x: 20, y: 20 });
    for (let step = 0; step < 16 * 8; step++) sim._simulate(sim._constructSimData());
    expect(sim.budget.miningFund).toBe(0);
    expect(sim._mining.reserves.tin).toBe(3 * MINE_MONTHS_PER_LEVEL);
  });

  test("has its words in both languages", () => {
    expect(hasKey("tool.mine") && hasKey("choice.title.mine") && hasKey("choice.none.mine") && hasKey("budget.mining") &&
      hasKey("msg.bad.mine_exhausted") && hasKey("msg.bad.oil_spill") && hasKey("msg.bad.toxic_ground") &&
      hasKey("map.layer.toxic") && hasKey("map.about.toxic") && hasKey("map.key.mine") && hasKey("about.building.mines"))
      .toBe(true);
    for (const kind of MINE_KINDS) {
      const tool = MINE_TOOLS[kind];
      expect([tool, hasKey(`tool.${tool}`), hasKey(`choice.${tool}`), hasKey(`rules.cost.${tool}`)]).toEqual([tool, true, true, true]);
    }
  });
});
