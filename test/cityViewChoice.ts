/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { chooseViewKind } from "../src/cityViewChoice";

class MemoryStore {
  items = new Map<string, string>();
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  setItem(key: string, value: string): void { this.items.set(key, value); }
}

describe("chooseViewKind", () => {
  test("2D by default", () => {
    expect(chooseViewKind("", new MemoryStore())).toBe("2d");
    expect(chooseViewKind("?province=TH-50", null)).toBe("2d");
  });

  test("?view=3d chooses 3D and is remembered after Main menu drops the address's parameters", () => {
    const store = new MemoryStore();
    expect(chooseViewKind("?view=3d", store)).toBe("3d");
    expect(chooseViewKind("", store)).toBe("3d");
    expect(chooseViewKind("?view=2d", store)).toBe("2d");
    expect(chooseViewKind("", store)).toBe("2d");
  });

  test("ignores anything else, and storage that refuses", () => {
    const store = new MemoryStore();
    expect(chooseViewKind("?view=4d", store)).toBe("2d");
    const refusing = { getItem(): string | null { throw new Error("denied"); }, setItem(): void { throw new Error("denied"); } };
    expect(chooseViewKind("?view=3d", refusing)).toBe("3d");
    expect(chooseViewKind("", refusing)).toBe("2d");
  });
});
