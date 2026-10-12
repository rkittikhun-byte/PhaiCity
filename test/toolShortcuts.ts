/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { hasKey } from "../src/i18n/index";
import { shortcutFor, TOOL_KEYS } from "../src/toolShortcuts";

const key = (code: string, modifiers: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...modifiers });

describe("tool shortcuts", () => {
  test("digits on the main row and the number pad pick tools; P pauses", () => {
    expect(shortcutFor(key("Digit1"))).toEqual({ tool: "residential" });
    expect(shortcutFor(key("Numpad4"))).toEqual({ tool: "road" });
    expect(shortcutFor(key("Digit9"))).toEqual({ tool: "query" });
    expect(shortcutFor(key("KeyP"))).toEqual({ pause: true });
  });

  test("leave everything else alone: 0, letters the game already uses, and keys with modifiers", () => {
    for (const code of ["Digit0", "KeyW", "KeyA", "KeyS", "KeyD", "Escape", "ArrowUp", "KeyH"]) expect(shortcutFor(key(code))).toBeNull();
    expect(shortcutFor(key("Digit1", { ctrlKey: true }))).toBeNull(); // browser tab switching
    expect(shortcutFor(key("KeyP", { metaKey: true }))).toBeNull(); // printing
    expect(shortcutFor(key("Digit2", { shiftKey: true }))).toBeNull();
  });

  test("every shortcut's tool has a button and a name", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    for (const { tool } of TOOL_KEYS) {
      expect(html).toContain(`data-tool="${tool}"`);
      expect(hasKey(`tool.${tool}`)).toBe(true);
    }
    expect(html).toContain('id="pauseRequest"');
  });
});
