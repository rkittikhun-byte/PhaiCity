/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Turns the national TopoJSON (data/geo/thailand-provinces.topo.json) into SVG path data for the
// province picker. Pure geometry: no DOM, so it can be unit-tested.

import { feature } from "topojson-client";

export interface ProjectedProvince {
  id: string;
  path: string;
  centroid: [number, number];
  area: number;
  /** [minX, minY, maxX, maxY] in SVG units */
  bounds: [number, number, number, number];
}

export interface NationalMap {
  provinces: ProjectedProvince[];
  viewBox: [number, number, number, number];
}

type Ring = number[][];

// SVG units per degree of latitude. Longitude is scaled by cos(13°), Thailand's middle latitude,
// so province shapes keep their real proportions (a local equirectangular projection).
const UNITS_PER_DEGREE = 100;
const MIDDLE_LATITUDE = 13;
const LONGITUDE_SCALE = Math.cos(MIDDLE_LATITUDE * Math.PI / 180) * UNITS_PER_DEGREE;
const PADDING = 20;

const project = ([lon, lat]: number[]): [number, number] => [lon * LONGITUDE_SCALE, -lat * UNITS_PER_DEGREE];

// Shoelace area and centroid of one projected ring.
function ringAreaAndCentroid(points: Array<[number, number]>): { area: number; centroid: [number, number] } {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    twiceArea += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cy += (points[j][1] + points[i][1]) * cross;
  }
  const area = twiceArea / 2;
  if (area === 0) {
    return { area: 0, centroid: points[0] ?? [0, 0] };
  }
  return { area: Math.abs(area), centroid: [cx / (6 * area), cy / (6 * area)] };
}

export function projectNationalMap(topology: any, layer = "provinces"): NationalMap {
  const collection: any = feature(topology, topology.objects[layer]);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const provinces: ProjectedProvince[] = collection.features.map((f: any) => {
    const polygons: Ring[][] = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    let path = "";
    let totalArea = 0;
    let largest = { area: -1, centroid: [0, 0] as [number, number] };
    const bounds: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];

    for (const polygon of polygons) {
      polygon.forEach((ring, ringIndex) => {
        const points = ring.map(project);
        points.forEach(([x, y], i) => {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          bounds[0] = Math.min(bounds[0], x);
          bounds[1] = Math.min(bounds[1], y);
          bounds[2] = Math.max(bounds[2], x);
          bounds[3] = Math.max(bounds[3], y);
          path += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
        });
        path += "Z";
        if (ringIndex === 0) {
          const measured = ringAreaAndCentroid(points);
          totalArea += measured.area;
          if (measured.area > largest.area) largest = measured;
        }
      });
    }

    // Labels go at the centroid of the largest outer ring, so islands don't pull them into the sea.
    return { id: String(f.id ?? f.properties?.id), path, centroid: largest.centroid, area: totalArea, bounds };
  });

  return {
    provinces,
    viewBox: [minX - PADDING, minY - PADDING, maxX - minX + 2 * PADDING, maxY - minY + 2 * PADDING],
  };
}

// Area-weighted centre of a group of provinces, used to place region labels.
export function groupCentroid(provinces: ProjectedProvince[]): [number, number] {
  let weight = 0;
  let x = 0;
  let y = 0;
  for (const p of provinces) {
    weight += p.area;
    x += p.centroid[0] * p.area;
    y += p.centroid[1] * p.area;
  }
  return weight > 0 ? [x / weight, y / weight] : [0, 0];
}

// The viewBox [x, y, width, height] that frames a group of provinces with a margin (a share of its size),
// used to zoom the province picker into one region.
export function groupViewBox(provinces: ProjectedProvince[], margin = 0.08): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of provinces) {
    minX = Math.min(minX, p.bounds[0]);
    minY = Math.min(minY, p.bounds[1]);
    maxX = Math.max(maxX, p.bounds[2]);
    maxY = Math.max(maxY, p.bounds[3]);
  }
  if (!Number.isFinite(minX)) return [0, 0, 0, 0];
  const padX = (maxX - minX) * margin;
  const padY = (maxY - minY) * margin;
  return [minX - padX, minY - padY, maxX - minX + 2 * padX, maxY - minY + 2 * padY];
}
