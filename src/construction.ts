/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Building time (เวลาก่อสร้าง, docs/GAME_DESIGN.md 6.1; owner, 21 Oct 2026): a big building goes up as a construction site
// and works only after its months (src/unlocks.ts `months`, scaled by the mode, src/gameModes.ts): a dam a year, a
// provincial hospital half a year. The building's tiles are down at once, so it can be bulldozed, moved or undone like
// any other, but until it is done the map scan passes its centre by (src/mapScanner.js): it gives no service, no power
// and no places, pays no upkeep and counts as no zone. The sites are kept by centre tile (map.sites, saved), and the
// monthly "construction" system of the core finishes them (src/core/cityCore.ts); a site whose building is gone is
// forgotten. Renderers may read map.sites to draw a site; they never write it.
// Plain code: no DOM, nothing random.

import { UNLOCKS } from "./unlocks.js";

/** The city's time runs 4 to a month (src/simulation.js _cityTime) */
export const TIME_PER_MONTH = 4;

export interface Site {
  /** The tool that built it */
  tool: string;
  /** The city's time when it is done */
  ready: number;
}

export type Sites = Record<string, Site>;

/** The months a tool's building stands as a site, in a mode (times scale), whole months; 0 for none */
export function siteMonths(tool: string, scale = 1): number {
  const months = UNLOCKS[tool]?.months ?? 0;
  return months > 0 ? Math.max(1, Math.round(months * scale)) : 0;
}

/** What of the map the sites are kept on (src/gameMap.js, typed loosely) */
export interface SiteMap {
  readonly width: number;
  readonly height: number;
  sites?: Sites | null;
  getTile(x: number, y: number): { isZone(): boolean };
}

/** Whether the building centred on this tile is still being built */
export function isSite(map: { sites?: Sites | null }, index: number): boolean {
  return Boolean(map.sites && map.sites[index] !== undefined);
}

/** The whole months left of the site centred on this tile (0 when it is not one) */
export function monthsLeft(map: { sites?: Sites | null }, index: number, now: number): number {
  const site = map.sites?.[index];
  return site ? Math.max(1, Math.ceil((site.ready - now) / TIME_PER_MONTH)) : 0;
}

/**
 * The building just put down by a tool, centred at (x, y), made a site for its months (none: no site, and any old one
 * there forgotten). What undoes it.
 */
export function startSite(map: SiteMap, x: number, y: number, tool: string, now: number, scale = 1): () => void {
  const sites = map.sites ??= {}, index = String(y * map.width + x), before = sites[index];
  const months = siteMonths(tool, scale);
  if (months > 0) sites[index] = { tool, ready: now + months * TIME_PER_MONTH };
  else delete sites[index];
  return () => {
    if (before) sites[index] = before;
    else delete sites[index];
  };
}

/** A site finished this month */
export interface SiteDone { tool: string; x: number; y: number }

/** A month of the sites (the core's "construction" system): those done are finished, those whose building is gone
 * forgotten; the finished ones, for the news */
export function sitesMonth(map: SiteMap, now: number): SiteDone[] {
  const done: SiteDone[] = [];
  const sites = map.sites;
  if (!sites) return done;
  for (const [key, site] of Object.entries(sites)) {
    const i = Number(key), x = i % map.width, y = Math.floor(i / map.width);
    // (every building a tool puts down starts or clears its centre's site, so a zone centre here is still this one)
    const stands = x >= 0 && y >= 0 && x < map.width && y < map.height && map.getTile(x, y).isZone();
    if (!stands) { delete sites[key]; continue; }
    if (now < site.ready) continue;
    delete sites[key];
    done.push({ tool: site.tool, x, y });
  }
  return done;
}

/** A save's sites (writeSites) */
export function readSites(saved: unknown): Sites {
  const sites: Sites = {};
  if (!saved || typeof saved !== "object") return sites;
  for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
    const s = value as Partial<Site> | null;
    if (!/^\d+$/.test(key) || !s || typeof s.tool !== "string" || !Number.isFinite(s.ready)) continue;
    sites[key] = { tool: s.tool, ready: s.ready as number };
  }
  return sites;
}

/** The sites as a save keeps them, or nothing */
export function writeSites(sites: Sites | null | undefined): Sites | undefined {
  return sites && Object.keys(sites).length ? JSON.parse(JSON.stringify(sites)) : undefined;
}
