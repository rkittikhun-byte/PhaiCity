/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { TOOL_ICONS } from '../../src/render3d/gallery/icons.js';
import { GameTools } from '../../src/gameTools.js';
import { MapGenerator } from '../../src/mapGenerator.js';

// Every tool the game has (src/gameTools.js) wears an icon (owner, 15 Oct 2026: "ใส่ icon มาให้หมดเลย"); the zone brushes
// and the eraser wear their zone's and the bulldozer's (src/toolShortcuts.ts ICON_OF), and "mine" is the mines' button
const tools: string[] = TOOL_ICONS.map(([id]) => id);
const colourOf = new Map<string, string>(TOOL_ICONS.map(([id, , , colour]) => [id, colour]));
const directory = resolve('assets/icons/tools');
const toolbar = readFileSync(resolve('index.html'), 'utf8');

describe('toolbar SVG icons', () => {
  it('ships and previews an icon for every tool, and its manifest', () => {
    expect(readdirSync(directory).filter(file => file.endsWith('.svg')).sort()).toEqual(tools.map(tool => `${tool}.svg`).sort());
    expect(new Set(tools).size).toBe(tools.length);
    const map = (MapGenerator as unknown as { fromPresetCells(w: number, h: number, cells: Uint8Array): unknown }).fromPresetCells(8, 8, new Uint8Array(64));
    const game = Object.keys(new (GameTools as unknown as new (map: unknown, rules: null) => object)(map, null))
      .filter(name => !/^(?:addEventListener|removeEventListener|_emitEvent|zone_\w+)$/.test(name));
    for (const tool of game) expect(tools).toContain(tool);
    expect(JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'))).toEqual({});
  });

  it.each(tools)('%s is a self-contained, licensed SVG readable at toolbar sizes', async tool => {
    const bytes = readFileSync(resolve(directory, `${tool}.svg`));
    const source = bytes.toString('utf8');
    expect(bytes.length).toBeLessThan(3000);
    expect(source).toMatch(/^<!-- PhaiCity\. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis\.\s+Released under the GNU GPL v3 with additional terms\. See LICENSE and COPYING\. -->/);
    const root = source.match(/<svg\b[^>]*>/)![0];
    expect(root).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(root).toContain('viewBox="0 0 48 48"');
    expect(root).not.toMatch(/\b(?:width|height)\s*=/i);
    expect(source).not.toMatch(/<(?:text|script|foreignObject|image|style)\b|<!DOCTYPE|<!ENTITY|\bon\w+\s*=/i);
    for (const reference of source.matchAll(/\b(?:[\w-]+:)?href\s*=\s*["']([^"']*)["']/gi)) {
      expect(reference[1]).toMatch(/^#[\w-]+$/);
    }
    for (const reference of source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/gi)) {
      expect(reference[1]).toMatch(/^#[\w-]+$/);
    }
    // Its button's colour where it has a button, else its choice's above the button
    const button = toolbar.match(new RegExp(`data-tool="${tool}"\\s+data-colour="([^"]+)"`));
    const colour = colourOf.get(tool)!;
    if (button) expect(colour).toBe(button[1]);
    expect(source).toContain(`fill="${colour}"`);
    expect(source).toContain('stroke="#1d2925"');
    const tones = new Set(Array.from(source.matchAll(/\b(?:fill|stroke)="([^"']+)"/g), match => match[1]).filter(value => value !== 'none'));
    expect(tones.size).toBeLessThanOrEqual(3);

    // libvips/librsvg parses the XML and rasterizes it, checking more than tag matching.
    for (const size of [18, 32, 48]) {
      const { data, info } = await sharp(bytes).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height, info.channels]).toEqual([size, size, 4]);
      expect(data[3]).toBe(0);
      expect(data[(size - 1) * 4 + 3]).toBe(0);
      expect(data[(size * (size - 1)) * 4 + 3]).toBe(0);
      expect(data[data.length - 1]).toBe(0);
      let opaque = 0;
      for (let pixel = 3; pixel < data.length; pixel += 4) if (data[pixel] > 128) opaque++;
      expect(opaque).toBeGreaterThan(size * size * 0.15);
      expect(opaque).toBeLessThan(size * size * 0.8);
    }
  });
});
