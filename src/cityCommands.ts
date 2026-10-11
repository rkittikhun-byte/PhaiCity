/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Every change a player makes to a city is a plain, serializable command applied here, through one entry
// point (docs/ONLINE_PLAN.md section 13, rule 1). The mouse and the windows only describe what the player
// asked for; CityCommands checks it and changes the city. In the online game a server can receive, check
// and replay the same commands. No DOM, jQuery or window here, so this also runs in Node.
// Looking at the city (the query tool, opening windows) is not a change, so it is not a command.

export const TOOL_NAMES = [
  "residential", "commercial", "industrial", "road", "rail", "wire", "park", "bulldozer",
  "police", "fire", "coal", "nuclear", "stadium", "port", "airport",
] as const;
export type ToolName = typeof TOOL_NAMES[number];

export const DISASTERS = ["fire", "flood", "tornado", "monster", "crash", "meltdown"] as const;
export type DisasterName = typeof DISASTERS[number];

export const SETTINGS = ["autoBudget", "autoBulldoze", "disasters"] as const;
export type SettingName = typeof SETTINGS[number];

/** The simulation's speeds: 0 paused, 1 slow, 2 medium, 3 fast. */
export const MAX_SPEED = 3;
export const MAX_TAX = 20;
/** What the debug window's "add funds" gives. */
export const DEBUG_FUNDS = 20000;

export type Command =
  | { type: "tool"; tool: ToolName; x: number; y: number }
  /** Tax rate in percent (0-20) and the share of each service's request funded (0-100). yearEnd answers the yearly budget. */
  | { type: "budget"; tax: number; road: number; fire: number; police: number; yearEnd: boolean }
  | { type: "disaster"; disaster: DisasterName }
  | { type: "setting"; setting: SettingName; on: boolean }
  | { type: "speed"; speed: number }
  | { type: "debugFunds" };

export interface CommandOutcome {
  accepted: boolean;
  /** Why a command was refused. */
  reason?: string;
  /** For tools: the tool's result code (BaseTool TOOLRESULT_*). */
  toolResult?: number | null;
}

interface CommandTool {
  result: number | null;
  doTool(x: number, y: number, blockMaps: unknown): void;
  modifyIfEnoughFunding(budget: unknown): boolean;
}

/** The parts of a city that commands change; game.js builds it from the simulation. */
export interface CommandTarget {
  readonly width: number;
  readonly height: number;
  readonly tools: Partial<Record<string, CommandTool>>;
  readonly blockMaps: unknown;
  readonly budget: {
    roadPercent: number;
    firePercent: number;
    policePercent: number;
    setTax(tax: number): void;
    doBudgetWindow(): void;
    updateFundEffects(): void;
    setAutoBudget(on: boolean): void;
    spend(amount: number): void;
  };
  readonly disasters: {
    disastersEnabled: boolean;
    makeFire(): void;
    makeFlood(): void;
    makeCrash(): void;
    makeMeltdown(): void;
  };
  readonly sprites: { makeMonster(): void; makeTornado(): void };
  setSpeed(speed: number): void;
  setAutoBulldoze(on: boolean): void;
}

const isInteger = (value: unknown, min: number, max: number): boolean =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

/** Why a command cannot be applied to a map of this size, or null when it can. Commands may come from anywhere. */
export function commandProblem(command: unknown, width: number, height: number): string | null {
  if (typeof command !== "object" || command === null) return "not a command";
  const c = command as Record<string, unknown>;
  switch (c.type) {
    case "tool":
      if (!isOneOf(TOOL_NAMES, c.tool)) return `unknown tool ${String(c.tool)}`;
      if (!isInteger(c.x, 0, width - 1) || !isInteger(c.y, 0, height - 1)) return "outside the map";
      return null;
    case "budget":
      if (!isInteger(c.tax, 0, MAX_TAX)) return "tax out of range";
      for (const service of ["road", "fire", "police"]) {
        if (!isInteger(c[service], 0, 100)) return `${service} funding out of range`;
      }
      return typeof c.yearEnd === "boolean" ? null : "yearEnd missing";
    case "disaster":
      return isOneOf(DISASTERS, c.disaster) ? null : `unknown disaster ${String(c.disaster)}`;
    case "setting":
      if (!isOneOf(SETTINGS, c.setting)) return `unknown setting ${String(c.setting)}`;
      return typeof c.on === "boolean" ? null : "setting value missing";
    case "speed":
      return isInteger(c.speed, 0, MAX_SPEED) ? null : "speed out of range";
    case "debugFunds":
      return null;
    default:
      return `unknown command type ${String(c.type)}`;
  }
}

export class CityCommands {
  constructor(private readonly city: CommandTarget) {}

  apply(command: Command): CommandOutcome {
    const problem = commandProblem(command, this.city.width, this.city.height);
    if (problem) return { accepted: false, reason: problem };
    const city = this.city;

    switch (command.type) {
      case "tool": {
        const tool = city.tools[command.tool];
        if (!tool) return { accepted: false, reason: `no ${command.tool} tool` };
        tool.doTool(command.x, command.y, city.blockMaps);
        tool.modifyIfEnoughFunding(city.budget);
        return { accepted: true, toolResult: tool.result };
      }
      case "budget":
        city.budget.roadPercent = command.road / 100;
        city.budget.firePercent = command.fire / 100;
        city.budget.policePercent = command.police / 100;
        city.budget.setTax(command.tax);
        if (command.yearEnd) city.budget.doBudgetWindow();
        else city.budget.updateFundEffects();
        break;
      case "disaster":
        if (command.disaster === "monster") city.sprites.makeMonster();
        else if (command.disaster === "tornado") city.sprites.makeTornado();
        else if (command.disaster === "fire") city.disasters.makeFire();
        else if (command.disaster === "flood") city.disasters.makeFlood();
        else if (command.disaster === "crash") city.disasters.makeCrash();
        else city.disasters.makeMeltdown();
        break;
      case "setting":
        if (command.setting === "autoBudget") city.budget.setAutoBudget(command.on);
        else if (command.setting === "autoBulldoze") city.setAutoBulldoze(command.on);
        else city.disasters.disastersEnabled = command.on;
        break;
      case "speed":
        city.setSpeed(command.speed);
        break;
      case "debugFunds":
        city.budget.spend(-DEBUG_FUNDS);
        break;
    }
    return { accepted: true };
  }
}
