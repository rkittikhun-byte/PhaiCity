# PhaiCity — Real Geography Specification

This file is the shared rulebook for real-world map data in PhaiCity.
AI agents (Codex / Claude Code) must read it in full before working on anything under `scripts/geo/`, `data/geo/` or `data/maps/`.

---

## 1. Goals

1. **National map:** the province picker uses real province shapes of Thailand (77 provinces, 6 regions).
2. **Province starting maps:** each province starts from the real natural geography around its city center:
   rivers, canals, moats, lakes, sea and forest.
   - **No real roads or buildings.** The player builds the city on empty land.
   - Every world's copy of a province starts from the same map, so rankings for one province are fair across worlds.
3. **Elevation (later):** visual only, for 3D hills. The simulation stays flat.

Province ids, names, regions and neighbors come from `data/thailand-provinces.json` (ids = ISO 3166-2:TH, e.g. `TH-50`).

## 2. Scale and projection

- **Default map:** 200 × 200 tiles at 10 m per tile, i.e. 2,000 × 2,000 m (decided 11 Oct 2026: at 120 × 100 the Chiang Mai moat fell outside the map).
  - Every script takes `width`, `height` and `tileSizeM` as parameters.
  - Never hardcode the size: the game map and every tool must read it from the preset.
- **North up:** map x → east, map y → south.
- **Projection:** local equirectangular around the map center (lat0, lon0):
  - `x_m = (lon − lon0) × cos(lat0) × 111320`
  - `y_m = (lat0 − lat) × 110574`
  - The error is negligible at this size. Don't add a projection library just for this.
- The map center sits at the middle of the grid. The bbox is derived from center, size and tile size.

## 3. Data sources and licenses

Only sources on this list may be used. Record every source used in `data/CREDITS.md`.

| Data | Source | License | Obligations |
|---|---|---|---|
| Province boundaries | Natural Earth 1:10m Admin-1 states/provinces | Public domain | None (credit is courteous) |
| Water, coast, forest, city centers | OpenStreetMap via the Overpass API | ODbL 1.0 | Visible in-game credit "© OpenStreetMap contributors"; files derived from OSM (`data/maps/`, `data/geo/province-centers.json`) are published under ODbL (`data/maps/LICENSE.md`) |
| Elevation (later) | Copernicus DEM GLO-30, or AWS Terrain Tiles | Check at download time | Record the required attribution in `data/CREDITS.md` |

**Forbidden:**
- GADM (non-commercial only)
- Google, Apple or Bing maps or imagery
- Any source whose license does not clearly allow commercial use

If unsure, stop and ask the project owner.

## 4. Files

| Path | Content | Committed? |
|---|---|---|
| `scripts/geo/*.mjs` | Pipeline scripts (Node 24, plain ESM JavaScript) | yes |
| `data/geo/thailand-provinces.topo.json` | Simplified province shapes (TopoJSON), feature id = `TH-xx` | yes |
| `data/geo/province-centers.json` | `{ "TH-50": { lat, lon, source, note } }`, chosen automatically | yes |
| `data/geo/center-overrides.json` | Manual centers edited by the owner; **always wins** over the automatic ones | yes |
| `data/geo/neighbor-edges.json` | For each province: `[{ neighbor, edge: "N"\|"E"\|"S"\|"W", from, to }]` where from/to are 0–1 positions along that edge | yes |
| `data/maps/TH-xx.json` | Preset starting map (format in section 5) | yes |
| `data/maps/LICENSE.md` | States that `data/maps/` is licensed under ODbL 1.0, with OSM attribution | yes |
| `data/geo/cache/` | Raw downloads (Natural Earth, Overpass responses) | **no** (gitignored) |

## 5. Preset map format

```json
{
  "format": 1,
  "provinceId": "TH-50",
  "width": 200,
  "height": 200,
  "tileSizeM": 10,
  "center": { "lat": 18.7883, "lon": 98.9853 },
  "bbox": [98.9796, 18.7838, 98.9910, 18.7928],
  "cells": "57:0,3:1,60:0,...",
  "stats": { "land": 0.71, "water": 0.18, "woods": 0.11 },
  "flags": [],
  "sources": ["OpenStreetMap contributors (ODbL 1.0)"],
  "generatedAt": "2026-10-11T00:00:00Z"
}
```

- `bbox` is `[west, south, east, north]` in WGS84.
- `cells` is row-major and run-length encoded as `count:code` pairs separated by commas.
- Cell codes:
  - `0` land
  - `1` water
  - `2` woods
- The example coordinates are placeholders, not real data.

## 6. Classification rules

**Water:**
- `natural=water` (any `water=*`), legacy `waterway=riverbank`, `landuse=reservoir|basin`, `natural=bay`
- The sea, built from `natural=coastline` ways:
  - OSM coastlines have land on the left and water on the right of the way direction
  - clip them to the bbox and close the polygon along the bbox edges
  - if this proves unreliable, use the osmdata.openstreetmap.de water polygons (ODbL) instead
- Line waterways, buffered by their `width` tag, or by these defaults when missing:
  - `river` 40 m
  - `canal` 12 m
  - `stream` 6 m
  - skip `drain` and `ditch`
- **Every buffered waterway is at least 1 tile wide and 4-connected**, so it never breaks into diagonal-only gaps.

**Woods:**
- `landuse=forest`, `natural=wood`, `natural=scrub`, `leisure=park`
- `wetland=mangrove` counts as woods (mangrove forest, ป่าชายเลน)
- Every other wetland counts as land.

**Per-cell decision:**
1. water if ≥ 50% of the cell is water
2. otherwise woods if ≥ 50% is woods
3. otherwise land

**Cleanup:**
- Remove isolated water specks smaller than 3 cells, unless they touch the map edge.
- Fill land holes smaller than 3 cells inside water.
- Keep moats (คูเมือง) and canals even when they are only 1–2 tiles wide.

## 7. Choosing the map center

Try these in order. Record which one was used in `source`.

1. `data/geo/center-overrides.json`
2. The `admin_centre` member of the province's OSM boundary relation (`boundary=administrative`, `admin_level=4`)
3. An OSM `place=city|town` node with `capital=4` inside the province
4. The OSM `place=*` node whose name matches the province's capital town

If none of them works, write `null` and add a flag. **Never invent coordinates.**

Bangkok has no single capital town. Use the old city (Rattanakosin) as its default center and note this in `note`.

## 8. Neighbor edges

- Bearing from a province's center to each neighbor's center gives the nearest edge:
  - N = 315°–45°
  - E = 45°–135°
  - S = 135°–225°
  - W = 225°–315°
- When several neighbors share one edge, split that edge into equal segments, ordered by bearing.
- Positions `from`/`to` (0–1) run **west→east on N and S edges** and **north→south on E and W edges**.
- An edge with no neighbor faces another country, the sea or open land; it has no "ด่าน".
- Phuket's only neighbor is Phang Nga, linked by the Sarasin bridge.

## 9. Quality gates (every map)

Add a flag to the map's `flags` array when any of these fails:

- `too_much_water`: land + woods < 40% of the map
- `no_water`: the province has a `river_*` or `coast_*` tag but the map has no water
  (the center is probably wrong)
- `coast_not_on_edge`: the province has a `coast_*` tag but the sea doesn't touch any map edge
- `center_missing`: no center could be found

Every flag must appear on the review page and in the final report.

## 10. Game integration

- Codes → tiles:
  - `0` → `DIRT`
  - `1` → `RIVER`
  - `2` → `WOODS`
- Then run the existing smoothing from `src/mapGenerator.js` (river edges and tree edges), so shores and forest edges use the normal edge tiles.
- A new city for a province uses its preset map. Random generation stays available for the "random map" mode.
- **Do not change the simulation.** Map loading may be added to `mapGenerator.js` / `gameMap.js` only, without changing their existing behavior.

## 11. Sensitivity

- The national map shows **Thailand only**: no neighboring countries, and no detail in disputed border areas.
- The national map always shows the note "แผนที่ประกอบเกม ไม่ใช่แผนที่ทางการ".
- The in-game credits show "© OpenStreetMap contributors" and "Natural Earth".

## 12. Definition of Done (every geo task)

1. Scripts are idempotent and read from `data/geo/cache/` when the data is already downloaded.
2. Overpass requests:
   - wait ≥ 2 s between requests
   - send a descriptive User-Agent
   - retry with backoff on 429/504
3. npm scripts exist for each step: `geo:national`, `geo:centers`, `geo:edges`, `geo:maps`, `geo:review`.
4. Unit tests cover RLE encode/decode, the projection, and rasterizing a synthetic polygon and line.
5. `npm test` and `npm run build` pass, and the game plays as before.
6. No changes to existing license headers. New files get the PhaiCity header (see `docs/3d/MODEL_SPEC.md` section 8).
7. Report to the project owner **in Thai**: what was produced, every flag found, and anything that needs a human decision.
