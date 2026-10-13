/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as fs from "fs";
import * as path from "path";
import { hasKey, setLanguage, t } from "../src/i18n/index";
import { DEFAULT_RULES, toolPrices } from "../src/provinceRules";
import {
  shortcutFor, showToolPrices, TOOL_DESCRIPTIONS, TOOL_KEYS, toolIconUrl, toolName, toolTitle,
} from "../src/toolShortcuts";

const key = (code: string, modifiers: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  ({ code, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...modifiers });

describe("tool icons", () => {
  test("every tool button has its icon file", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const tools = [...html.matchAll(/data-tool="(\w+)"/g)].map((m) => m[1]);
    expect(tools.length).toBe(21);
    // The water tools, the mine, the farm and the harbour wait for their icons (Codex Prompts W1, M1 and F1); their buttons show a square in their colour until then
    const awaitingIcons = ["waterworks", "watertower", "mine", "farm", "fishing"];
    for (const tool of tools.filter((t) => !awaitingIcons.includes(t))) {
      expect(fs.existsSync(path.join(__dirname, "..", toolIconUrl(tool)))).toBe(true);
    }
  });
});

describe("tool shortcuts", () => {
  test("digits on the main row and the number pad pick tools; P pauses; M opens the city map", () => {
    expect(shortcutFor(key("Digit1"))).toEqual({ tool: "residential" });
    expect(shortcutFor(key("Numpad4"))).toEqual({ tool: "road" });
    expect(shortcutFor(key("Digit9"))).toEqual({ tool: "query" });
    expect(shortcutFor(key("KeyP"))).toEqual({ pause: true });
    expect(shortcutFor(key("KeyM"))).toEqual({ map: true });
    expect(shortcutFor(key("KeyM", { ctrlKey: true }))).toBeNull();
  });

  test("leave everything else alone: 0, letters the game already uses, and keys with modifiers", () => {
    for (const code of ["Digit0", "KeyW", "KeyA", "KeyS", "KeyD", "Escape", "ArrowUp", "KeyH"]) expect(shortcutFor(key(code))).toBeNull();
    expect(shortcutFor(key("Digit1", { ctrlKey: true }))).toBeNull(); // browser tab switching
    expect(shortcutFor(key("KeyP", { metaKey: true }))).toBeNull(); // printing
    expect(shortcutFor(key("Digit2", { shiftKey: true }))).toBeNull();
  });

  test("every tool button explains itself: name, key if any, and what it does", () => {
    const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
    const tools = [...html.matchAll(/data-tool="([a-z]+)"/g)].map((m) => m[1]);
    expect(tools.length).toBeGreaterThanOrEqual(16);
    for (const tool of tools) {
      expect({ tool, described: TOOL_DESCRIPTIONS[tool] !== undefined && hasKey(TOOL_DESCRIPTIONS[tool]) }).toEqual({ tool, described: true });
    }
    setLanguage("th");
    const [first, second] = toolTitle("residential", "1").split("\n");
    expect(first).toBe("ที่อยู่อาศัย ฿100 (ปุ่มลัด 1)");
    expect(second.startsWith("เขตที่อยู่อาศัย")).toBe(false); // the About page's "Name: " is left out
    expect(second.length).toBeGreaterThan(10);
    expect(toolTitle("airport", null).split("\n")[0]).toBe("สนามบิน ฿10K");
  });

  test("show a city's own prices on the buttons", () => {
    setLanguage("th");
    expect(toolName("residential")).toBe("ที่อยู่อาศัย ฿100");
    showToolPrices({ ...toolPrices(DEFAULT_RULES), residential: 60, coal: 4500 });
    expect(toolName("residential")).toBe("ที่อยู่อาศัย ฿60");
    expect(toolName("coal")).toBe("โรงไฟฟ้าถ่านหิน ฿4.5K");
    expect(toolName("query")).toBe(t("tool.query"));
    showToolPrices(toolPrices(DEFAULT_RULES));
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
