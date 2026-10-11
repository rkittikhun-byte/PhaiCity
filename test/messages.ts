/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import * as Messages from "../src/messages";

describe("Messages", () => {
    const stringConstants = Object.entries(Messages)
        .filter(([, value]) => typeof value === "string") as Array<[string, string]>;

    test("every message constant has a distinct value", () => {
        // Event listeners and the text/sound tables are keyed by these values,
        // so two constants sharing a value would make their events indistinguishable.
        const seen = new Map<string, string>();
        const clashes: string[] = [];

        for (const [name, value] of stringConstants) {
            const previous = seen.get(value);
            if (previous !== undefined) {
                clashes.push(`${previous} and ${name} share "${value}"`);
            } else {
                seen.set(value, name);
            }
        }

        expect(clashes).toEqual([]);
    });

    test("heavy traffic is not confused with a funds change", () => {
        expect(Messages.HEAVY_TRAFFIC).not.toBe(Messages.FUNDS_CHANGED);
    });

    test("high and low explosion sounds are distinguishable", () => {
        expect(Messages.SOUND_EXPLOSIONHIGH).not.toBe(Messages.SOUND_EXPLOSIONLOW);
    });
});
