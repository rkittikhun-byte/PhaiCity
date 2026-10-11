/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { BufferGeometry, Group, LineBasicMaterial, LineSegments, Vector3 } from 'three';
import type { ModelOptions, ModelRegistration } from '../models/registry.js';
import { CABLE_BRIDGE, createCableBridge } from '../models/road/cable-bridge.js';
import { disposeModel } from '../util/geometry.js';

export const CABLE_PREVIEW_ID = 'preview.cable_bridge';

/** Gallery assembly only. Individual model factories never contain stay geometry. */
export function cableBridgePreview(options: ModelOptions = {}): Group {
  const root = new Group(); root.name = CABLE_PREVIEW_ID;
  const pylon = createCableBridge(true, options); root.add(pylon);
  const decks = new Map<number, Group>();
  for (let tile = -10; tile <= 10; tile++) {
    if (!tile) continue;
    const deck = createCableBridge(false, { ...options,
      worldOrigin: [options.worldOrigin?.[0] ?? 0, (options.worldOrigin?.[1] ?? 0) + tile * 10] });
    deck.position.z = tile * 10; decks.set(tile, deck); root.add(deck);
  }
  root.updateMatrixWorld(true);
  const points: Vector3[] = [], pairs: { mast: string; deckTile: number; deck: string }[] = [];
  for (const side of [0, 1]) for (let n = 0; n < CABLE_BRIDGE.anchorsPerSide; n++) {
    const tile = (n % 2 ? 1 : -1) * (Math.floor(n / 2) + 1);
    const mastName = `anchor_cable_${side}_${n}`, deckName = `anchor_cable_${side ? 'right' : 'left'}`;
    points.push(pylon.getObjectByName(mastName)!.getWorldPosition(new Vector3()),
      decks.get(tile)!.getObjectByName(deckName)!.getWorldPosition(new Vector3()));
    pairs.push({ mast: mastName, deckTile: tile, deck: deckName });
  }
  const stays = new LineSegments(new BufferGeometry().setFromPoints(points), new LineBasicMaterial({ color: 0xb8bec0 }));
  stays.name = 'gallery/cable-stays'; stays.userData.pairs = pairs; root.add(stays);
  root.userData = { tiles: 21, stays: pairs.length, region: options.region ?? 'central' };
  return root;
}

export const CABLE_PREVIEW: ModelRegistration = {
  factory: cableBridgePreview, category: 'road', footprint: [1, 21], tiles: [],
  budget: 21 * 1500, regionTier: 'R3', ground: 'bridge', tiling: true,
};

/** Stay buffers and their gallery-only material belong to the assembly, not the library. */
export function disposeCableBridgePreview(root: Group): void {
  disposeModel(root);
  root.traverse(object => {
    if (object instanceof LineSegments) {
      object.geometry.dispose();
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    }
  });
}
