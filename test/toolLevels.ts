/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Buttons with choices (src/toolLevels.ts, docs/TOOLS_PLAN.md): a grouped button takes the size and colour of the
// tool it uses, and the tools without a button of their own read theirs from the page's #toolChoices template.

import { setLanguage } from "../src/i18n/index";
import { pageChoice, setToolChoices } from "../src/toolLevels";

interface FakeButton { dataset: Record<string, string | undefined>; disabled: boolean; title: string }

/** A page with the given tool buttons and the template, enough for the two functions (Jest runs without a DOM). */
function page(buttons: Record<string, { size: string; colour: string }>,
    kept: Record<string, { size: string; colour: string }>) {
  const elements: Record<string, FakeButton> = {};
  for (const [tool, { size, colour }] of Object.entries(buttons)) {
    elements[tool] = { dataset: { tool, size, colour }, disabled: false, title: "" };
  }
  const toolOf = (selector: string) => /data-tool="(\w+)"/.exec(selector)?.[1] ?? "";
  const doc = {
    querySelector: (selector: string) => (selector.startsWith(".toolButton") ? elements[toolOf(selector)] ?? null : null),
    getElementById: (id: string) => (id !== "toolChoices" ? null : {
      content: {
        querySelector: (selector: string) => {
          const found = kept[toolOf(selector)];
          return found ? { dataset: { size: found.size, colour: found.colour } } : null;
        },
      },
    }),
  } as unknown as Document;
  return { doc, elements };
}

describe("buttons with choices", () => {
  beforeAll(() => setLanguage("th"));

  test("a tool without a button reads its size and colour from the page", () => {
    const { doc } = page({ port: { size: "4", colour: "dodgerblue" } }, { airport: { size: "6", colour: "violet" } });
    expect(pageChoice("airport", true, doc)).toEqual({ tool: "airport", available: true, colour: "violet", size: 6 });
    expect(pageChoice("port", false, doc)).toEqual({ tool: "port", available: false, colour: "dodgerblue", size: 4 });
    expect(pageChoice("unknown", true, doc)).toEqual({ tool: "unknown", available: true, colour: undefined, size: undefined });
  });

  test("the button wears the size and colour of the tool it uses, and keeps its own for its own tool", () => {
    const { doc, elements } = page({ port: { size: "4", colour: "dodgerblue" } }, { airport: { size: "6", colour: "violet" } });
    const port = pageChoice("port", true, doc);
    const airport = pageChoice("airport", true, doc);
    setToolChoices("port", [port, airport], doc);
    expect(elements.port.dataset).toMatchObject({ activeTool: "port", size: "4", colour: "dodgerblue" });

    // The port cannot be built (say), so the button takes the airport and its six tiles
    setToolChoices("port", [{ ...port, available: false }, airport], doc);
    expect(elements.port.dataset).toMatchObject({ activeTool: "airport", size: "6", colour: "violet" });
    // Reading the port's own choice again still gives the port's size, not the airport's it wears now
    expect(pageChoice("port", true, doc)).toMatchObject({ size: 4, colour: "dodgerblue" });

    setToolChoices("port", [{ ...port, available: false }, { ...airport, available: false }], doc);
    expect(elements.port.disabled).toBe(true);
  });
});
