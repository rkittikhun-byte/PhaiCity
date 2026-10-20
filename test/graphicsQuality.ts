/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The player's graphics setting (src/graphicsQuality.ts): kept per browser like the language, Auto by default, shown
// and changed by the settings window's choices, and handed to the 3D view at once.

type Module = typeof import("../src/graphicsQuality");

class MemoryStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
}

/** A radio input of the settings window, enough for the binding */
class Radio {
  checked = false;
  private listeners: ((event: Event) => void)[] = [];
  constructor(readonly value: string) {}
  addEventListener(_type: string, listener: (event: Event) => void): void { this.listeners.push(listener); }
  removeEventListener(_type: string, listener: (event: Event) => void): void { this.listeners = this.listeners.filter(l => l !== listener); }
  click(): void { this.checked = true; this.listeners.forEach(listener => listener({ target: this } as unknown as Event)); }
}

function load(stored?: string): { module: Module; storage: MemoryStorage } {
  const storage = new MemoryStorage();
  if (stored !== undefined) storage.setItem("phaicity.graphics", stored);
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  let module!: Module;
  jest.isolateModules(() => { module = require("../src/graphicsQuality"); });
  return { module, storage };
}

function settingsWindow(): { doc: Document; radios: Radio[]; fieldset: { disabled: boolean; toggleAttribute(name: string, on: boolean): void } } {
  const radios = ["auto", "low", "medium", "high"].map(value => new Radio(value));
  const fieldset = { disabled: false, toggleAttribute(_name: string, on: boolean) { this.disabled = on; } };
  const doc = { querySelectorAll: () => radios, getElementById: (id: string) => id === "graphicsSettings" ? fieldset : null } as unknown as Document;
  return { doc, radios, fieldset };
}

afterEach(() => { delete (globalThis as { window?: unknown }).window; });

describe("the graphics setting", () => {
  it("is Auto until the player chooses, and remembers a choice for this browser", () => {
    const { module, storage } = load();
    expect(module.getGraphicsQuality()).toBe("auto");
    module.setGraphicsQuality("high");
    expect(storage.getItem("phaicity.graphics")).toBe("high");
    expect(load("high").module.getGraphicsQuality()).toBe("high");
  });

  it("ignores what it does not know, saved or set", () => {
    const { module } = load("ultra");
    expect(module.getGraphicsQuality()).toBe("auto");
    module.setGraphicsQuality("ultra" as never);
    expect(module.getGraphicsQuality()).toBe("auto");
  });

  it("gives the view the setting at once and every change after, and the window's choices show and change it", () => {
    const { module, storage } = load("medium");
    const view = { setQuality: jest.fn() }, { doc, radios, fieldset } = settingsWindow();
    const stop = module.bindGraphicsQuality(view, doc);
    expect(view.setQuality).toHaveBeenLastCalledWith("medium");
    expect(radios.find(r => r.checked)?.value).toBe("medium");
    expect(fieldset.disabled).toBe(false);
    radios[3].click();
    expect(view.setQuality).toHaveBeenLastCalledWith("high");
    expect(storage.getItem("phaicity.graphics")).toBe("high");
    expect(radios.filter(r => r.checked).map(r => r.value)).toEqual(["high"]);
    stop();
    module.setGraphicsQuality("low");
    expect(view.setQuality).toHaveBeenLastCalledWith("high");
  });

  it("greys the choices out for the 2D view, which has no lens", () => {
    const { module } = load();
    const { doc, fieldset } = settingsWindow();
    module.bindGraphicsQuality({}, doc);
    expect(fieldset.disabled).toBe(true);
  });

  it("works without storage (a private window): the choice lasts until the page closes", () => {
    (globalThis as { window?: unknown }).window = { get localStorage(): never { throw new Error("denied"); } };
    let module!: Module;
    jest.isolateModules(() => { module = require("../src/graphicsQuality"); });
    expect(module.getGraphicsQuality()).toBe("auto");
    module.setGraphicsQuality("low");
    expect(module.getGraphicsQuality()).toBe("low");
  });
});
