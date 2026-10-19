# Canals (คลอง)

Proposed 19 Oct 2026; the owner said go ahead with steps 1–3 the same day, and they are built (branch `claude/canals`).
Step 4 (the smooth 3D canal) and step 5 wait.

A canal tool beside the road and rail tools: the player draws a canal the way they draw a road (straight, curve,
S-curve, free), and it becomes water on the map. Thai towns grew along their canals (irrigation, drainage, boats,
floating markets), so it suits the game, and most of what water already does in the simulation comes for free.

## What the game already has

- **Water tiles.** RIVER (2), REDGE (3), CHANNEL (4) and the shore tiles 5–20 (`src/tileValues.ts`). No tool places
  them; the bulldozer only removes them. Real canals and streams of the city maps are already stamped as one-tile water
  (`scripts/geo/lib/provinceMap.mjs`), but the map does not remember they were canals.
- **3D canal banks.** `createWater` (`src/render3d/models/terrain/water.ts`) already sees a canal (land on two opposite
  sides, `isCanal`) and gives it concrete or brick walls and 9.4 m of water in the 16 m tile. Water is drawn per tile,
  so a slanted canal shows as a staircase until step 4 below.
- **Drawing.** `src/drawPaths.ts` (the path shapes) and the strokes and pieces in `CityCommands` work for any kind;
  only a few places name road or rail by hand (`LINE_TOOLS` in `src/drawModes.ts`, line 417 and `followPath` in
  `src/cityCommands.ts`, `lineKind` and `networkLines` in `src/game.js`, `networkOf(map, rail)` in
  `src/roadGeometry.ts`, `piecesOnLines` in `src/core/cityLayers.ts`).

## What a canal gives, by itself

| Already there | Works at once? |
|---|---|
| Land value: water raises it nearby (`blockMapUtils.js`) | yes |
| Dams and fishing harbours need water beside them (`plantProblem`, `farmProblem`) | yes |
| Road and rail across water build a bridge (straight only) | yes, when the road comes after the canal |
| Boats sail on RIVER and CHANNEL tiles | yes |
| Groundwater is fullest near water (`computeGroundwater`), which feeds water works and farms | **no**: it is worked out only when a city loads; the tool must recompute it |
| Floods start only from shore tiles 5–20 (`disasterManager.js`) | no, a canal of plain RIVER never floods (good) |
| A canal drawn across an existing road | **no**: the tool must turn that road tile into a bridge |

## Plan

Status: steps 1–3 done (`src/canals.ts`, `src/canalTool.ts`, `test/canals.ts`); 4 and 5 not started.

1. **Tool and command.** *(done)* A `canal` tool in the roads group of the dock, after rail, priced by `provinceRules`
   (`TOOL_COSTS`, never a number in code), strings in `docs/i18n/UI_STRINGS.md`. It lays RIVER on clear land and
   woods, a bridge where it crosses a straight road or railway, and refuses buildings, corners and junctions. The
   stroke is one piece in `roadPieces` / `roadPaths` like a road, so draw modes, undo and saves need nothing new;
   `isCanalTile` joins `isRoadTile` / `isRailTile` where the kind is chosen.
   *As built:* ฿40 a tile, ฿50 a road bridge, ฿100 a rail bridge (`CANAL_*` in `src/canals.ts`, `BASE_PRICES.canal`).
   Canals keep no pieces: the dug tiles are enough for now, and step 4 can draw its centrelines from them as roads were
   drawn before the pieces. The canal's water has the bulldoze bit, so the bulldozer fills it in; the land's own rivers
   still cannot be bulldozed. In the game the canal draws like a power line did (line modes, snapping onto water, no
   road dots); it waits for the ruler's house like the rail tool.
2. **Simulation.** *(done: `WaterManager.refreshGround`, run at the next simulation step after `gameMap.groundChanged`;
   the ground round new water fills by as much more as it now holds)* Recompute groundwater after each canal stroke (and after the bulldozer fills one in). Keep the
   price high enough that lining every street with canals for land value does not pay.
3. **Remember canals.** *(done: `gameMap.canals`, saved as `canals`, carried when a district frame grows; the
   inspector says คลอง; the city maps' real canals are not marked yet)* A small `gameMap.canals` layer (saved, like `roadLevels`) so the 3D view, the city map and
   the inspector tell a canal from a river; the city maps' real canals can fill it too.
4. **3D.** First the existing per-tile canal walls. Then a smooth canal along each piece's drawn path (walls, water
   and steps following the curve, the same way roads follow `roadPaths`), with the owner's road rules: one surface,
   curved corners, no round caps.
5. **Later, if wanted.** Levels (a ditch, an irrigation canal, a big khlong with boats), a canal that drains floods,
   farms watered from a canal, a boat stop for public transport, a floating market.

## Risks

- The road 3D files (`src/render3d/city/roadCurves.ts`, `roadBuild.ts`) are being changed in the main folder right
  now, on `codex/regional-character-sheets`, not yet in `main`. Steps 1–3 stay out of them; step 4 waits until that
  work reaches `main`.
- `networkOf(map, rail: boolean)` would become a kind (`road | rail | canal`); every caller changes with it.
