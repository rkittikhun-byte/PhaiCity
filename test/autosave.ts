/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { installAutosave } from "../src/autosave";

// A window and document that record listeners, with a clock the test turns by hand
function setup(options: { committed?: boolean; results?: boolean[] } = {}) {
  const listeners = new Map<string, () => void>();
  let tick: (() => void) | null = null;
  const host = {
    setInterval: (handler: () => void) => { tick = handler; return 1; },
    clearInterval: () => { tick = null; },
    addEventListener: (type: string, listener: () => void) => listeners.set(type, listener),
    removeEventListener: (type: string) => listeners.delete(type),
  };
  const doc = { visibilityState: "visible", addEventListener: host.addEventListener, removeEventListener: host.removeEventListener };
  const results = [...(options.results ?? [])];
  const events: string[] = [];
  let committed = options.committed ?? true;
  const autosave = installAutosave({
    save: () => { events.push("save"); return results.length ? results.shift()! : true; },
    shouldAutosave: () => committed,
  }, { onSaved: () => events.push("note"), onFull: () => events.push("full") }, host, doc);
  return {
    autosave, events, listeners, doc,
    tick: () => tick?.(),
    commit: () => { committed = true; },
  };
}

describe("autosave", () => {
  test("saves on the timer with a note, and quietly when the page is hidden or closed", () => {
    const { events, listeners, doc, tick } = setup();
    tick();
    doc.visibilityState = "hidden";
    listeners.get("visibilitychange")!();
    listeners.get("pagehide")!();
    expect(events).toEqual(["save", "note", "save", "save"]);
  });

  test("a practice city waits until it has been saved by hand", () => {
    const { events, tick, commit } = setup({ committed: false });
    tick();
    expect(events).toEqual([]);
    commit();
    tick();
    expect(events).toEqual(["save", "note"]);
  });

  test("a full storage is reported once, then again only after a save has worked", () => {
    const { events, tick } = setup({ results: [false, false, true, false] });
    tick(); tick(); tick(); tick();
    expect(events).toEqual(["save", "full", "save", "save", "note", "save", "full"]);
  });

  test("stops for good when the player leaves without saving", () => {
    const { autosave, events, listeners, tick } = setup();
    autosave.stop();
    tick();
    expect(listeners.size).toBe(0);
    expect(events).toEqual([]);
  });
});
