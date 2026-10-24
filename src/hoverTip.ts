/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The small tooltip beside the pointer over an object of the city (src/hoverPick.ts): one or two short lines in small
// type, no pointer events, never over the pointer, kept inside the screen. The game tells it what to say and where.

import { inspectLine } from "./inspectCard.js";
import { tooltipPlace, type TooltipLine } from "./hoverPick.js";

export class HoverTip {
  private readonly element: HTMLElement;
  private shown = false;
  private text = "";

  constructor(doc: Document = document) {
    this.element = doc.createElement("div");
    this.element.id = "hoverTip";
    this.element.setAttribute("role", "tooltip");
    this.element.hidden = true;
    doc.body.appendChild(this.element);
  }

  /** Shows the lines beside the pointer at (x, y) in the window's CSS pixels */
  show(lines: readonly TooltipLine[], x: number, y: number): void {
    const text = formatTooltip(lines);
    if (text !== this.text) {
      this.text = text;
      this.element.textContent = text;
    }
    if (!this.shown) {
      this.element.hidden = false;
      this.shown = true;
    }
    const box = this.element.getBoundingClientRect();
    const place = tooltipPlace(x, y, box.width, box.height, window.innerWidth, window.innerHeight);
    this.element.style.left = `${Math.round(place.x)}px`;
    this.element.style.top = `${Math.round(place.y)}px`;
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.text = "";
    this.element.hidden = true;
  }
}

/** Formats the tooltip's lines; a farm field says its crop and level together ("ไร่ข้าวโพด ระดับ 3" / "Maize field, level 3") */
export function formatTooltip(lines: readonly TooltipLine[]): string {
  return lines.map((line) => {
    if (line.length === 2 && line[0].key.startsWith("farm.") && line[1].key === "object.fact.level") {
      const title = inspectLine(line[0].key, line[0].params);
      const level = inspectLine(line[1].key, line[1].params);
      return /^Level\b/.test(level) ? `${title}, l${level.slice(1)}` : `${title} ${level}`;
    }
    return line.map(part => inspectLine(part.key, part.params)).join(" · ");
  }).join("\n");
}
