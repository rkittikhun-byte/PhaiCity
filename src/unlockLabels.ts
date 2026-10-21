/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// What the player reads about a tool the city cannot build yet (docs/GAME_DESIGN.md 6.2; owner, 21 Oct 2026): the
// reason the unlock table gives (src/unlocks.ts) in plain words, "ต้องมีวิศวกร 200 คน (ตอนนี้ 35)", "ต้องเข้ายุคเมือง
// สมัยใหม่", for the tool buttons, their choices and a refused command; and the list of what the next era brings, for
// the era card. Words only: no DOM.

import { hasKey, t } from "./i18n/index";
import { toolLabel } from "./toolShortcuts";
import type { UnlockLock } from "./unlocks";
import { MINE_TOOLS } from "./mining";

const isMineTool = (tool: string): boolean => (Object.values(MINE_TOOLS) as string[]).includes(tool);

const count = (value: unknown): string => Number(value).toLocaleString("en-US");

/** A tool's name without its price */
export const plainToolName = (tool: string): string => toolLabel(tool).name;

/** What must stand first, in words: a named need (any power plant, a railway, a paved road, a school), else the tool */
function needName(need: string): string {
  return hasKey(`unlock.need.${need}`) ? t(`unlock.need.${need}`) : plainToolName(need);
}

/** Why the tool is locked, in the language of the moment */
export function lockText(lock: UnlockLock): string {
  const p = lock.params;
  switch (lock.reason) {
    case "unlock.era": return t("unlock.era", { era: t(`era.name.${p.era}`) });
    case "unlock.trained": return t("unlock.trained", { kind: t(`trained.${p.kind}`), need: count(p.need), have: count(p.have) });
    case "unlock.first": return t("unlock.first", { need: needName(String(p.need)) });
    case "unlock.limit": return t("unlock.limit", { count: count(p.count), era: t(`era.name.${p.era}`) });
  }
}

/** A refused command's reason and detail as a lock, when it was refused for one (src/cityCommands.ts) */
export function lockOf(outcome: { reason?: string; detail?: Record<string, string | number> }): UnlockLock | null {
  const reason = outcome.reason;
  return reason && reason.startsWith("unlock.") && outcome.detail ? { reason: reason as UnlockLock["reason"], params: outcome.detail } : null;
}

/** A locked tool button's title: its name and why */
export function lockedTitle(tool: string, lock: UnlockLock): string {
  return t("unlock.locked_title", { name: plainToolName(tool), reason: lockText(lock) });
}

/** The names of what an era brings, each once, in the table's order (the mines and wells read as one) */
export function unlockNames(tools: readonly string[]): string[] {
  const names: string[] = [];
  for (const tool of tools) {
    if (tool.startsWith("zone_")) continue; // the brushes are their zones
    const name = isMineTool(tool) ? t("dock.group.mine") : plainToolName(tool);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}
