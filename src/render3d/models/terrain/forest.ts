/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Box3, Matrix4 } from 'three';
import { tint } from '../../materials/library.js';
import { regionalLeafColor, vegetationMix, WeightedTree } from '../../regional/vegetation.js';
import { seededRng } from '../../rng.js';
import type { ModelOptions } from '../registry.js';
import { PlantBuilder, point } from '../vegetation/builder.js';
import type { TreeKind } from '../vegetation/trees.js';
import { horizontal, mask4, SIDES, TerrainBuilder } from './helpers.js';

function pick(list: readonly WeightedTree[], rng: () => number): WeightedTree {
  let sample = rng() * list.reduce((sum, item) => sum + item.weight, 0);
  for (const item of list) { sample -= item.weight; if (sample < 0) return item; }
  return list[list.length - 1];
}

/** Dedicated forest LOD: preserve species silhouette while spending 80–260 triangles per tree. */
function simplifiedTree(kind: TreeKind, rng: () => number, options: ModelOptions, detail = 1): PlantBuilder {
  const b = new PlantBuilder(), bark = tint('wood_teak', 0x83715b), leaf = tint('foliage_tropical', regionalLeafColor(options.region));
  const palm = ['coconut', 'oil_palm', 'sugar_palm'].includes(kind), bamboo = kind === 'bamboo';
  const trunkTop = palm ? 6.5 : kind === 'pine' ? 8 : 5;
  const crown = point(kind === 'coconut' ? 0.45 : 0, trunkTop, 0);
  if (bamboo) {
    for (let culm = 0; culm < (detail === 1 ? 5 : 3); culm++) {
      const angle = culm * 2.4, x = Math.cos(angle) * 0.4, z = Math.sin(angle) * 0.4;
      b.taper([point(x, 0, z), point(x * 1.2, 4, z * 1.2), point(x * 2.6, 7.6, z * 2.6)], 0.075, bark, 3, 3);
    }
  } else if (kind === 'banana') {
    for (let stem = 0; stem < 5; stem++) b.taper([point((stem - 2) * 0.35, 0, (stem % 2 - 0.5) * 0.2),
      point((stem - 2) * 0.45, 4 + stem * 0.35, (stem % 2 - 0.5) * 0.3)], 0.16, bark, 3, 4);
  } else b.taper([point(0, 0, 0), point(kind === 'coconut' ? -0.3 : 0.05, trunkTop * 0.5, 0), crown],
    kind === 'oil_palm' ? 0.42 : 0.18, bark, 4, 4);
  if (palm) for (let frond = 0; frond < (detail === 1 ? 10 : 8); frond++) {
    const frondCount = detail === 1 ? 10 : 8;
    const angle = frond * Math.PI * 2 / frondCount + rng() * 0.1, tip = crown.clone().add(point(Math.cos(angle) * 2.2, -1.2, Math.sin(angle) * 2.2));
    const curve = b.taper([crown, crown.clone().add(point(Math.cos(angle) * 1.1, 0.7, Math.sin(angle) * 1.1)), tip], 0.045, bark, 2, 3);
    for (let pair = 0; pair < 6; pair++) for (const side of [-1, 1]) {
      const center = kind === 'sugar_palm' ? curve.getPointAt(0.4 + pair * 0.1) : curve.getPointAt((pair + 1) / 7);
      const a = angle + side * (kind === 'sugar_palm' ? (pair + 1) * 0.18 : 0.75);
      b.leaf(center, point(Math.cos(a), -0.25, Math.sin(a)), kind === 'sugar_palm' ? 1.1 : 0.95, 0.28, leaf, angle);
    }
  } else if (kind === 'banana') {
    for (let i = 0; i < 22; i++) b.leaf(point((i % 5 - 2) * 0.4, 4.0 + (i % 4) * 0.4, (i % 3 - 1) * 0.25),
      point(Math.cos(i * 1.8), 0.35, Math.sin(i * 1.8)), 2.1, 0.85, leaf, i, -0.25, 2, i % 3 === 0);
  } else {
    const umbrella = ['rain_tree', 'tamarind', 'mangrove'].includes(kind);
    const cards = Math.round((kind === 'pine' ? 150 : bamboo ? 120 : 160) * Math.max(0.75, detail));
    for (let i = 0; i < cards; i++) {
      const t = (i + 0.5) / cards, angle = i * 2.399963;
      const radius = kind === 'eucalyptus' ? 1.25 : kind === 'durian' || kind === 'pine' ? 2.2 * t : umbrella ? 2.45 * Math.sqrt(t) : 1.95 * Math.sqrt(t);
      const y = umbrella ? 7.6 - t * 1.1 : 8.2 - t * 2.8;
      const center = point(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      if (i % 12 === 0 && !bamboo) b.taper([crown, center], 0.065, bark, 1, 3);
      b.leaf(center, point(Math.cos(angle + 0.6), 0.25, Math.sin(angle + 0.6)),
        kind === 'teak' ? 1.45 : bamboo ? 0.95 : 1.25, kind === 'pine' || kind === 'eucalyptus' || bamboo ? 0.22 : 0.75,
        leaf, rng() * Math.PI, 0.1, 1, false, i % 2 === 0);
    }
  }
  if (kind === 'mangrove') for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    b.taper([point(0, 2.3, 0), point(Math.cos(a) * 0.7, 1, Math.sin(a) * 0.7),
      point(Math.cos(a) * 1.2, 0.02, Math.sin(a) * 1.2)], 0.09, bark, 3, 3);
  }
  if (kind === 'rubber' && detail === 1) {
    b.tube([point(-0.16, 1.4, 0.16), point(0.16, 1.1, 0.18)], 0.025, bark, 1, 3);
    b.ellipsoid(point(0, 0.9, 0.22), point(0.13, 0.08, 0.13), bark, 4, 3);
  }
  return b;
}

export function createWoods(options: ModelOptions = {}) {
  const b = new TerrainBuilder(options), rng = seededRng(options.seed), mask = mask4(options.variant), waterMask = mask4(options.waterMask);
  const mix = vegetationMix(options.region).filter(item => !item.nearWaterOnly || waterMask !== 0);
  const placements: { id: string; x: number; z: number; row: boolean }[] = [];
  const cells = [[-2.4, -2.4], [2.4, -2.4], [-2.4, 2.4], [2.4, 2.4], [0, 0]];
  for (let index = 0; index < cells.length; index++) {
    const species = pick(mix, rng), kind = species.id.slice(4) as TreeKind;
    const tree = simplifiedTree(kind, rng, options, index === 4 ? 0.5 : 1), size = 0.85 + rng() * 0.3;
    tree.transformPlant(index === 0 ? 12 : index === 4 ? 6.5 : 8.5, size, rng() * Math.PI * 2, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.04);
    const bounds = new Box3(); tree.parts.forEach(part => { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox!); });
    const extent = Math.max(Math.abs(bounds.min.x), bounds.max.x, Math.abs(bounds.min.z), bounds.max.z);
    const widthScale = Math.min(1, (species.nearWaterOnly ? 1.75 : 2.15) / extent);
    const [cx, cz] = cells[index], row = species.placement === 'rows';
    let x = cx + (row ? 0 : (rng() - 0.5) * 0.5), z = cz + (row ? 0 : (rng() - 0.5) * 0.5);
    if (species.nearWaterOnly) {
      const shore = SIDES.find(side => waterMask & side.bit)!;
      x = shore.x ? shore.x * 3 : cx; z = shore.z ? shore.z * 3 : cz;
    }
    const transform = new Matrix4().makeTranslation(x, 0, z).multiply(new Matrix4().makeScale(widthScale, 1, widthScale));
    tree.parts.forEach(part => {
      part.geometry.applyMatrix4(transform);
      if (part.material.userData.materialKey === 'foliage_tropical') b.add(part.geometry, part.material);
      else b.world(part.geometry, part.material);
    });
    b.leafCards += tree.leafCards; placements.push({ id: species.id, x, z, row });
  }
  const bark = tint('wood_teak', 0x83715b), leaf = tint('foliage_tropical', regionalLeafColor(options.region));
  for (const side of SIDES) {
    const connected = Boolean(mask & side.bit);
    for (let i = 0; i < (connected ? 16 : 4); i++) {
      const along = -4.45 + (i + 0.5) / (connected ? 16 : 4) * 8.9;
      const x = side.x ? side.x * (connected ? 4.65 : 4.0) : along;
      const z = side.z ? side.z * (connected ? 4.65 : 4.0) : along;
      b.leaf(point(x, connected ? 2.4 + i % 3 * 0.6 : 0.35, z), point(-side.x, 0.4, -side.z),
        connected ? 0.85 : 0.55, 0.35, leaf, i, 0.05);
      if (connected && i % 4 === 0) b.taper([point(x, 0, z), point(x - side.x * 0.2, 3.5, z - side.z * 0.2)], 0.045, bark, 2, 3);
    }
  }
  const root = b.finishTerrain('terrain.woods', [horizontal()], tint('grass', 0x819164), Array.from({ length: 19 }, (_, i) => i + 21));
  root.userData.woodsMask = mask; root.userData.waterMask = waterMask; root.userData.trees = placements;
  return root;
}
