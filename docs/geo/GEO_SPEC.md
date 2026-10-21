# PhaiCity — Real Geography Specification

This file is the shared rulebook for real-world map data in PhaiCity.
AI agents (Codex / Claude Code) must read it in full before working on anything under `scripts/geo/`, `data/geo/` or `data/maps/`.

---

## 1. Goals

1. **National map:** the province picker uses real province shapes of Thailand (77 provinces, 6 regions).
2. **Province maps (owner, 12 Oct 2026):** each province is played on **the whole province, scaled down**:
   - its real shape; tiles outside it show the real land around it but **cannot be built on**
   - its real natural geography: big rivers, lakes and reservoirs, sea and coast, forest
   - its real **main railway lines**
   - **one laterite road (ถนนลูกรัง) to each neighbouring province**: the real main road, from the border to the
     provincial town. Every other road, and every building, is the player's to build.
   - Every world's copy of a province starts from the same map, so rankings for one province are fair across worlds.
3. **Transport facts (การคมนาคม):** each province lists what links it to the rest of the country: its roads and
   railways to neighbouring provinces, its waterways (big rivers; the sea for coastal provinces) and, later, its
   passenger airports. The province card shows them.
4. **Elevation:** each province map carries its tiles' heights (section 5), for 3D hills and later for floods that
   follow the land. The simulation stays flat until the owner decides otherwise.

Province ids, names, regions and neighbors come from `data/thailand-provinces.json` (ids = ISO 3166-2:TH, e.g. `TH-50`).

The first version (11 Oct 2026) was a 2 × 2 km area at 10 m per tile around each provincial town, with no roads.
It is replaced by the whole province.

## 2. Scale and projection

- **Each province has its own scale** (`scripts/geo/lib/provinceArea.mjs`):
  - about 30,000 tiles inside the province, whatever its size
  - no side longer than 300 tiles; a long province gets bigger tiles instead
  - 4 tiles of the surrounding land on every side, then each side rounded up to a multiple of 8 (the simulation
    reads the map in blocks of 2, 4 and 8 tiles), so a side can reach 304
  - the tile size is rounded up to 5 m: from about 110 m (Samut Songkhram) to about 1 km (Chiang Mai)
  - maps are about 38,000–81,000 tiles in all (average 58,000); the old 2 × 2 km maps were 40,000
- Every script and the game read `width`, `height` and `tileSizeM` from the map file. Never hardcode a size.
- **North up:** map x → east, map y → south.
- **Projection:** local equirectangular around the middle of the province's bounding box (lat0, lon0):
  - `x_m = (lon − lon0) × cos(lat0) × 111320`
  - `y_m = (lat0 − lat) × 110574`
  - Good enough at province size. Don't add a projection library just for this.
- The province's own shape is the Natural Earth one the national map uses, so neighbouring maps agree on the border.

## 3. Data sources and licenses

Only sources on this list may be used. Record every source used in `data/CREDITS.md`.

| Data | Source | License | Obligations |
|---|---|---|---|
| Province boundaries | Natural Earth 1:10m Admin-1 states/provinces | Public domain | None (credit is courteous) |
| Water, coast, forest, main roads, railways, airports, city centers | OpenStreetMap, via the Overpass API or the Geofabrik extract of Thailand (`download.geofabrik.de/asia/thailand-*.osm.pbf`) | ODbL 1.0 | Visible in-game credit "© OpenStreetMap contributors"; files derived from OSM (`data/maps/`, `data/geo/province-centers.json`) are published under ODbL (`data/maps/LICENSE.md`) |
| Elevation | Copernicus DEM GLO-90 (90 m), from its open-data copy on AWS (`npm run geo:dem`) | Copernicus DEM licence: free for any use, commercial included | The notice "produced using Copernicus WorldDEM-90 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved" with anything made from it (`data/CREDITS.md`, shown on the About page) |

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
| `data/geo/province-centers.json` | `{ "TH-50": { lat, lon, source, note } }`, chosen automatically: the provincial town | yes |
| `data/geo/center-overrides.json` | Manual centers edited by the owner; **always wins** over the automatic ones | yes |
| `data/geo/neighbor-edges.json` | Map edge facing each neighbor, for the old 2 × 2 km maps (section 8) | yes |
| `data/maps/TH-xx.json` | Province map (format in section 5) | yes |
| `data/maps/LICENSE.md` | States that `data/maps/` is licensed under ODbL 1.0, with OSM attribution | yes |
| `data/geo/cache/` | Raw downloads (Natural Earth, Overpass) and preview pictures | **no** (gitignored) |
| `data/geo/cache/overpass/national/<layer>/<lat>_<lon>.json` | One layer for one 1° square, trimmed to what the maps use: from Overpass (`geo:download`) or the extract (`geo:extract`), the same form | no |
| `data/geo/cache/dem/Copernicus_DSM_COG_30_*_DEM.tif` | Copernicus DEM GLO-90, one 1° square each (84 squares, 360 MB; open sea has none), read by `scripts/geo/lib/geotiff.mjs` | no |
| `data/geo/cache/pbf/thailand-*.osm.pbf` | The Geofabrik extract of Thailand, read by `scripts/geo/lib/pbf.mjs` (no dependency) | no |
| `data/geo/cache/neighbor-countries.geojson` | Myanmar, Laos, Cambodia and Malaysia from Natural Earth (`geo:national`), only to stop roads at the border; never drawn | no |
| `data/geo/cache/preview/TH-xx.png` | `geo:maps -- --preview` pictures, for checking maps by eye | no |

## 5. Province map format

```json
{
  "format": 2,
  "provinceId": "TH-40",
  "width": 265,
  "height": 276,
  "tileSizeM": 545,
  "center": { "lat": 16.4, "lon": 102.5 },
  "bbox": [101.8, 15.7, 103.1, 17.1],
  "cells": "57:0,3:1,60:0,...",
  "transport": "9000:0,1:1,264:0,1:2,...",
  "inside": "300:0,40:1,225:0,...",
  "town": { "x": 197, "y": 122 },
  "exits": [
    { "neighbor": "TH-44", "kind": "road", "ref": "12", "x": 216, "y": 121 },
    { "neighbor": "TH-41", "kind": "rail", "name": "สายตะวันออกเฉียงเหนือ", "x": 204, "y": 40 }
  ],
  "waterways": [{ "th": "แม่น้ำชี", "en": "Chi River" }],
  "airports": [{ "th": "ท่าอากาศยานขอนแก่น", "en": "Khon Kaen Airport", "iata": "KKC" }],
  "heights": { "min": 120, "step": 2, "data": "eNrtwTEBAAAAwqD1T20ND6AAAAA..." },
  "stats": { "insideTiles": 29681, "land": 0.86, "water": 0.04, "woods": 0.1, "roadTiles": 263, "railTiles": 201,
             "heightMin": 140, "heightMax": 610 },
  "flags": [],
  "unlinked": [],
  "sources": ["OpenStreetMap contributors (ODbL 1.0)", "Natural Earth (public domain)"],
  "generatedAt": "2026-10-12T00:00:00Z"
}
```

- `bbox` is `[west, south, east, north]` in WGS84; `center` is the middle of the province's bounding box.
- `cells`, `transport` and `inside` are row-major and run-length encoded as `count:code` pairs separated by commas.
- `cells`: `0` land, `1` water, `2` woods.
- `transport`: `0` none, `1` road, `2` railway, `3` a road crossing a railway on the level.
- `inside`: `1` in the province, `0` outside it (shown, never built on).
- `town`: the provincial town's tile (section 7), where the camera starts and every road begins.
- `exits`: where each road or railway leaves the province, with the neighbour it leads to, the road's number
  (`ref`) or the railway's name. Only neighbouring Thai provinces; a line leading abroad has no exit.
- `waterways`: the big rivers that run through the province, longest first.
- `airports`: the province's passenger airports (OSM `aeroway=aerodrome` with an `iata` code inside its shape).
- `heights`: each tile's mean ground height in metres, row by row, as bytes: `min + level × step`, the bytes deflated
  (zlib) and in base64. Open sea is 0. It is a surface model (the tops of trees and towns), which a few hundred metres
  a tile smooths out. The simulation stays flat; the 3D view and the province card use it.
- `stats`: shares of land, water and woods **inside the province**, its road and railway tiles, and its lowest and
  highest tile in metres.
- `unlinked`: neighbouring provinces with no road link (see the `neighbor_unlinked` flag).
- The example values are placeholders, not real data.

Format 1 (the 2 × 2 km maps) had only `cells`, with `center` at the town. The game reads both.

## 6. Classification rules

**Water:**
- `natural=water` (any `water=*`), legacy `waterway=riverbank`, `landuse=reservoir|basin`; areas whose outline is
  under 1 km are skipped when downloading (too small for any map).
- The sea, built from `natural=coastline` ways: OSM coastlines have land on the left and water on the right of the
  way direction. The coastline is drawn as a barrier and each region on its water side becomes sea.
- **Big rivers** (`waterway=river`) are also drawn as a line of water one tile wide, so narrow rivers still show:
  - named like a river: แม่น้ำ…, ลำน้ำ…, น้ำ… or ลำ…, but not ห้วย, ลำห้วย, ลำราง, ลำธาร or คลอง
  - at least 25 tiles long around the map
  - **every river line is 4-connected**, so it never breaks into diagonal-only gaps
  - a big river with at least 10 of its tiles in the province is one of its `waterways`

**Woods:**
- `landuse=forest`, `natural=wood`, and `wetland=mangrove` (mangrove forest, ป่าชายเลน); outline at least 1 km.
- Every other wetland counts as land.

**Per-tile decision** (measured on a grid 4 × 4 finer than the tiles):
1. water if ≥ 50% of the tile is water
2. otherwise woods if ≥ 50% is woods
3. otherwise land

**Cleanup:**
- Remove isolated water specks smaller than 3 tiles, unless they touch the map edge.
- Fill land holes smaller than 3 tiles inside water.

**Inside the province:** a tile is inside when its centre is inside the province's shape (section 2).

## 6B. Railways and roads

Both are drawn so the game can build them as they are (`scripts/geo/lib/routing.mjs`):
- **one tile wide and 4-connected**, like the game's own roads and railways; never two tiles wide
- **straight across water**: the game's bridges cannot turn
- a road crosses a railway **only at right angles, on a straight piece of track, and not on a bridge** (the game's
  level-crossing tiles)
- each line follows its real course: it is routed across the tiles within 2.5 tiles of the real line (6 when that
  fails), the cheapest way that keeps the rules above
- a second carriageway, or a second track, reuses the first one's tiles

**Railways:** every `railway=rail` way without a `service` tag (no sidings, yards or spurs) that enters the
province. Where a line would run on outside the province for more than 20 tiles, it stops 6 tiles past the border.

**Roads to the neighbours (ถนนลูกรัง, owner 12 Oct 2026):** one per neighbouring province, and no other road.
1. The main roads (`highway=motorway|trunk|primary`) and their slip roads (`_link`, only to join them up) form a
   graph; primary roads weigh 1.25 times their length, so routes keep to the bigger roads. A main road that ends
   within 500 m of another is joined to it (they often meet through a smaller road).
2. For each neighbour, the cheapest way is found from every main road within 5 km of the town to the neighbour,
   through the province, that neighbour and land in neither (a strait, a river); never through a third province
   or abroad. Road outside the province costs 4 times its length, so the way keeps inside where it can.
3. The point in the neighbour reached with the smallest *cost + straight distance to the neighbour's town* ends
   the way: the real road between the two towns, as far as the map goes. The road then runs on into the
   neighbour, to the map's edge or as far as it goes there.
4. Where the road leaves the province for the last time is its exit. It is drawn from the town's tile through the
   exit to the map's edge, or 6 tiles past the exit when the map's edge is more than 20 tiles further.
5. A neighbour with no main road across the border gets no road (`neighbor_unlinked`).

**Not abroad:** roads and railways stop at the last dry Thai ground before land abroad, so the railway over the
Friendship Bridge ends at the Nong Khai bank. Land abroad is inside a neighbouring country's outline and at least
1.5 km from every Thai province's: both outlines are generalised and overlap along the border.

Roads are laid after the railways, the most important first, so later roads join the earlier ones.

## 7. Choosing the map center

Try these in order. Record which one was used in `source`.

1. `data/geo/center-overrides.json`
2. The `admin_centre` member of the province's OSM boundary relation (`boundary=administrative`, `admin_level=4`)
3. An OSM `place=city|town` node with `capital=4` inside the province
4. The OSM `place=*` node whose name matches the province's capital town

If none of them works, write `null` and add a flag. **Never invent coordinates.**

Bangkok has no single capital town. Use the old city (Rattanakosin) as its default center and note this in `note`.

On a province map the center is the **town**: the inside, dry tile nearest it.

## 8. Neighbor edges (the 2 × 2 km maps)

`data/geo/neighbor-edges.json` gave each neighbour a stretch of the old map's edge. Province maps (format 2) use
the real `exits` instead; the file stays until the game no longer reads format 1.

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

- `too_much_water`: land + woods < 40% of the province
- `center_missing`: no center could be found, so the map has no town and no roads
- `neighbor_unlinked`: a neighbour in `data/thailand-provinces.json` has no road; listed in `unlinked`
- `route_failed`: a railway or road could not be drawn by the rules of section 6B

Every flag must appear on the review page and in the final report.

## 10. Game integration

- Cells → tiles: `0` → `DIRT`, `1` → `RIVER`, `2` → `WOODS`; then the existing smoothing from `src/mapGenerator.js`
  (river edges and tree edges), so shores and forest edges use the normal edge tiles.
- Transport → tiles, after the smoothing: roads, railways, bridges on water and level crossings, each joined to its
  neighbours the way the game's own tools join them.
- Outside the province (`inside` 0): the tiles are kept as they are and **every tool is refused there**
  (`CityCommands`), the bulldozer included. The mask is saved with the city.
- **The roads and railways a map starts with are the state's** (owner, 12 Oct 2026): the city pays no upkeep for
  them and they never wear out, but the player may build over them and widen them like any road. The map keeps the
  starting transport layer (`GameMap.nationalTransport`, saved as `national`); `src/road.js` and `src/transport.js`
  count those tiles apart (`census.nationalRoadTotal`, `nationalRailTotal`) and skip their wear, and
  `src/budget.js` leaves them out of the upkeep. This is the only change to the simulation.
- The camera starts on the town, and ⌂ returns to it.
- The 3D view shows outside tiles dimmed, and the laterite look of level-1 roads (Codex request,
  `docs/3d/CODEX_PROMPTS.md`).
- A new city for a province uses its map. Random generation stays available for the practice mode.
- **Do not change the simulation.** Map loading may be added to `mapGenerator.js` / `gameMap.js` only, without
  changing their existing behavior.

## 11. Sensitivity

- The national map shows **Thailand only**: no neighboring countries, and no detail in disputed border areas.
- A province map shows the land around the province as terrain only: no names, borders or roads abroad.
- The national map always shows the note "แผนที่ประกอบเกม ไม่ใช่แผนที่ทางการ".
- The in-game credits show "© OpenStreetMap contributors" and "Natural Earth".

## 12. Definition of Done (every geo task)

1. Scripts are idempotent and read from `data/geo/cache/` when the data is already downloaded.
2. Overpass requests:
   - wait ≥ 2 s between requests
   - send a descriptive User-Agent
   - retry with backoff on 429/504
   - declare modest limits (`[timeout]`, `[maxsize]`); busy servers turn away greedy requests
3. npm scripts exist for each step: `geo:national`, `geo:centers`, `geo:download` or `geo:extract`, `geo:maps`,
   `geo:review` (`geo:edges` for the old maps).
4. Unit tests cover RLE encode/decode, the projection, rasterizing a synthetic polygon and line, and routing.
5. `npm test` and `npm run build` pass, and the game plays as before.
6. No changes to existing license headers. New files get the PhaiCity header (see `docs/3d/MODEL_SPEC.md` section 8).
7. Report to the project owner **in Thai**: what was produced, every flag found, and anything that needs a human decision.
8. After the province maps are built again, the owner looks at every map on the review page (`npm run geo:review`,
   `geo-review.html`: all 77 maps by region, flags in red, a click enlarges one and shows its centre). Where a town
   centre is wrong, the owner fixes it in `data/geo/center-overrides.json` and `npm run geo:maps` runs again.

## 13. Local Thailand Database (PostgreSQL + PostGIS) & Real-Scale District Maps

Real-scale district and city maps (`16 m/tile`, `data/maps/district/TH-xx-*.json`) are generated offline from the local Thailand PostGIS database (`scripts/geo/lib/db.mjs`, `dbLayers.mjs`, `cityStreets.mjs`, `landCover.mjs`, `wholeDistrict.mjs`).

| Parameter | Value |
|---|---|
| Host & Port | `localhost:5432` |
| Database | `thailand` (PostGIS + `postgis_raster` + `hstore`, EPSG:4326) |
| Tables | `planet_osm_point`, `planet_osm_line`, `planet_osm_polygon`, `planet_osm_roads`, `dem_glo90` |
| Commands | `npm run geo:districts -- --only TH-40` and `npm run geo:city -- --only TH-40 --districts` |

