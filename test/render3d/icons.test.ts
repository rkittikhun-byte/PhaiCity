/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { TOOL_ICONS } from '../../src/render3d/gallery/icons.js';

const tools = ['residential', 'commercial', 'industrial', 'road', 'rail', 'wire', 'park', 'police',
  'fire', 'coal', 'nuclear', 'stadium', 'port', 'airport', 'bulldozer', 'query'];
const directory = resolve('assets/icons/tools');
const toolbar = readFileSync(resolve('index.html'), 'utf8');

describe('toolbar SVG icons', () => {
  it('ships and previews exactly the sixteen game tools', () => {
    expect(readdirSync(directory).sort()).toEqual(tools.map(tool => `${tool}.svg`).sort());
    expect(TOOL_ICONS.map(([id]) => id).sort()).toEqual([...tools].sort());
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
    const colour = toolbar.match(new RegExp(`data-tool="${tool}"\\s+data-colour="([^"]+)"`))![1];
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
