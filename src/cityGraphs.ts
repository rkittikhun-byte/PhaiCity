/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city graphs (src/graphWindow.js): the history the census keeps for every city (src/census.js), drawn as
// two line charts. The census takes 120 samples per range, newest first: every month for the short range
// (10 years) and every 10 months for the long one (100 years). Only reads the census.

export type GraphRange = "10" | "120";

export interface Series {
  id: string;
  colour: string;
  /** Oldest first. */
  values: number[];
}

export interface CensusHistory {
  [name: string]: unknown;
}

export const RANGE_YEARS: Record<GraphRange, number> = { "10": 10, "120": 100 };

/** People and work: residents, shops and offices, factories, sharing one scale. */
export const PEOPLE_SERIES = [
  { id: "res", colour: "#2e9e44" },
  { id: "com", colour: "#2f6fd0" },
  { id: "ind", colour: "#c99400" },
] as const;

/** Life and money, each 0–255; for cash flow 128 means income equals spending. */
export const LIVING_SERIES = [
  { id: "crime", colour: "#d03b3b" },
  { id: "pollution", colour: "#7a6a3a" },
  { id: "money", colour: "#1b8a7a" },
] as const;

export const LIVING_MAX = 255;
export const MONEY_BALANCE = 128;

function history(census: CensusHistory, id: string, range: GraphRange): number[] {
  const values = census[`${id}Hist${range}`];
  if (!Array.isArray(values)) return [];
  return values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).reverse();
}

export function graphSeries(census: CensusHistory, range: GraphRange): { people: Series[]; living: Series[] } {
  const pick = (list: ReadonlyArray<{ id: string; colour: string }>): Series[] =>
    list.map(({ id, colour }) => ({ id, colour, values: history(census, id, range) }));
  return { people: pick(PEOPLE_SERIES), living: pick(LIVING_SERIES) };
}

/** The scale's top for the people chart: the largest visible value, at least 1. */
export function peopleMax(series: Series[]): number {
  return Math.max(1, ...series.flatMap((s) => s.values));
}

/** SVG points "x,y x,y …" for values on a width × height chart whose top is max (y grows downwards). */
export function linePoints(values: number[], max: number, width: number, height: number): string {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((value, i) => {
    const y = height - (Math.max(0, Math.min(value, max)) / max) * height;
    return `${(i * step).toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

const SVG = "http://www.w3.org/2000/svg";

/** Draws one chart into an <svg>: a faint frame, an optional middle line, and a line per visible series. */
export function drawChart(svg: SVGSVGElement, series: Series[], hidden: ReadonlySet<string>, max: number,
  middle: number | null = null): void {
  const width = 480;
  const height = 150;
  const doc = svg.ownerDocument;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  const nodes: SVGElement[] = [];
  const frame = doc.createElementNS(SVG, "rect");
  frame.setAttribute("x", "0");
  frame.setAttribute("y", "0");
  frame.setAttribute("width", String(width));
  frame.setAttribute("height", String(height));
  frame.setAttribute("class", "graphFrame");
  nodes.push(frame);
  if (middle !== null) {
    const y = height - (middle / max) * height;
    const line = doc.createElementNS(SVG, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("x2", String(width));
    line.setAttribute("y1", y.toFixed(1));
    line.setAttribute("y2", y.toFixed(1));
    line.setAttribute("class", "graphMiddle");
    nodes.push(line);
  }
  for (const s of series) {
    if (hidden.has(s.id)) continue;
    const line = doc.createElementNS(SVG, "polyline");
    line.setAttribute("points", linePoints(s.values, max, width, height));
    line.setAttribute("stroke", s.colour);
    line.setAttribute("class", "graphLine");
    nodes.push(line);
  }
  svg.replaceChildren(...nodes);
}
