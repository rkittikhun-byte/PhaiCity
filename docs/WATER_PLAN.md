# ระบบประปา (Water supply)

The owner asked for a water supply like the one in later city builders (13 Oct 2026). Decisions:
- **Pipes run under the roads by themselves** (no pipe tool, no underground view).
- **The dry season matters**, set per region and province in `data/province-rules.json`.
- **Groundwater** shows on the city map (key M) in shades of blue, from the real land.
- **Groundwater runs out when it is pumped for long** (owner, 13 Oct 2026: "น้ำใต้ดิน ใช้ไปนานๆ มันก็จะหมดๆ ไปด้วย"),
  and the rains fill it again.

This file is the plan and the record; the code is the truth.

## For the player

| | |
|---|---|
| **โรงผลิตน้ำประปา** (water works, 3×3, ฿1,500) | Pumps groundwater into every road it touches. Needs power, like any building. Gives as much as the ground under it holds: about 65 zones beside a river or a lake, about 11 on dry ground far from water. Gives less in a month of the province's dry season. |
| **หอถังสูง** (water tower, 1 tile, ฿300) | Stores water through the rains and gives it back in the dry season: each tower beside a road that carries water makes up to 10 zones of what the dry season takes from the works. It adds nothing in the rains, and draws no groundwater. |
| **Pipes** | Every road, bridge and level crossing joined to a powered water works carries water. A zone has water when a road with water touches its side. |
| **Without water** | Houses still fill a home zone, and shops and factories open at their first size, but nothing grows bigger: apartments, bigger shops and bigger factories need water. Bigger zones without water slowly shrink back, as zones without power do. |
| **Not enough water** | When the zones on the pipes want more than the supply, the zones the scan reaches last go dry, and the news says "น้ำประปาไม่พอ". |
| **Groundwater runs low** | A works draws from the ground around it (4 tiles out) as much as the city takes. Ground near rivers and lakes fills again fast; dry ground far from water fills slowly, so a works there pumped hard drains it, and gives less and less. No rain fills any ground in the dry season. The news warns, at most once a year, when a works' ground holds less than half of what its land holds; the warning takes the view there. |
| **City map** | "น้ำใต้ดิน" (groundwater, blue shades: deeper where the ground holds more, as it is now) to choose where to pump and to watch it run low; "ประปา" (zones with water in blue, without in orange, the pipes in light blue, with a count). |
| **First tasks** | "ทำน้ำประปา" after the shops and factories: a works whose water reaches a zone. |

Tuned with a sketch of ten years of full pumping (the supply each June): a works by a river loses about a third
and then holds; one 6 tiles inland loses about half; three side by side 6 tiles inland lose more than half together.
Most of the fall comes in the first two or three years. A works serving half of what it could falls far less.

## How the simulation does it

- `src/groundwater.ts`: each tile's natural level, 0–7, from the land: open water 7, land at most 6, falling over
  12 tiles from the nearest water (on a map at real scale, 16 m tiles, over 2 km instead: since 15 Oct 2026, as 12 of
  its tiles are only 192 m and left every works in a town on nearly dry ground, `falloffTiles`) and by one level per
  15 m above it (with the map's heights), never below 1. Each tile's store (0–224, 32 per level) starts full. Once a month: the rains give back level² / 384 of what a
  store lacks (not in a dry month); each works draws `10 × the share of its full output it pumped` from its centre,
  less further out, as far as 4 tiles, never from open water. A works pumps in proportion to the mean store under
  its 3×3.
- `src/waterManager.ts` (`WaterManager`, beside `src/powerManager.js`):
  - the map scan finds water works (centre tile) and towers and counts them in the census (`waterWorksPop`,
    `waterTowerPop`);
  - every cycle (phase 11) a flood fill runs from every powered works along road tiles; the supply for the next
    cycle is `Σ 80 × pump factor × (1 − dry share)` plus, in a dry month, what the towers on the pipes give back
    (10 each, at most what the dry season took);
  - on a month's first cycle the ground changes first (rain, then each works' draw for the share of the supply the
    zones took);
  - each R/C/I zone takes one share in the scan (`supplyZone`); when none is left it is dry and NOT_ENOUGH_WATER is
    sent (once a cycle; the simulation relays it at most every two minutes, as for power); the census counts
    `wateredZoneCount` and `dryZoneCount`;
  - a painted plot (`supplyPlot`, `docs/ZONE_PAINT.md`) takes an eighth of a share once it has a building; an empty
    lot takes none and is not counted (since 15 Oct 2026: a growing town's empty lots took the water its buildings
    needed, and the factories, which the scan reached last, never had any);
  - `view` (`WaterView`) is what may be read from outside: `zoneWater(x, y)` (1 water, 2 dry but fine at its size,
    3 thirsty: dry and held back or shrinking), `hasWater(x, y)` for roads, `groundwater(x, y)`. It sits on the map
    as `gameMap.water` for the renderer and in `simulation.blockMaps.water` for the city map.
  - Saves keep the stores as `groundwater` (run-length encoded like the map); the natural levels come from the land
    again, so a server replays them. A save from before the water supply starts with full ground.
- Zones (`residential.js`, `commercial.js`, `industrial.js`): without water, homes stop at eight houses (no
  apartments) and apartments are scored as unpowered zones are; shops and factories stop at their first size and
  bigger ones decline the same way. Fixed on the way: a home zone falling from apartments to houses set the centre
  tile eight times and lost the zone (the micropolisJS port wrote `(x, y)` instead of `(xx, yy)`).
- News (`src/simulation.js` `_sendMessages`): NEED_WATER when a city with more than ten zones has no works.
- Tiles: the water works uses the unused 3×3 tile range 956–964 (once CHURCH1, never placed by the game; no religious
  buildings are allowed anyway), centre 960 with ZONEBIT; the tower uses 1020 (BURNBIT | BULLBIT). 965–973 became
  the mines (docs/MINING.md), 974–991 the farms and fishing harbours (docs/FARMING.md); 992–1018 stay free for the
  high-speed rail station (ONLINE_PLAN 5.5).
- Commands: two new tools, `waterworks` (`BuildingTool`, size 3) and `watertower` (`src/waterTowerTool.ts`), through
  `CityCommands` like every tool; prices in `provinceRules.ts` (`BASE_PRICES`), changeable per province.
- Dry season: `drought: { months, share }` in each region of `data/province-rules.json` (north, central, west, east
  Dec–Apr at 25–30%; northeast Dec–Apr at 40%; south Feb–Apr at 15%); the province card says it.
- No upkeep in the first version.

## Codex (graphics)

Prompt W1 in `docs/3d/CODEX_PROMPTS.md`: the water works (pump house, basins, clear-water tank: national, R3),
the water tower (the tall Thai village tower), the no-water icon over thirsty zones (`gameMap.water.zoneWater` 3,
RENDERER_SPEC 6C) and the two tool icons. Until then the renderer shows the works as a generic service building,
the tower as its debug model, and the tool buttons a square in their colour.

## Later

- Upkeep for water works in the budget.
- Water treatment, and polluted groundwater near factories and mines (the province profile's costs).
- Salt water creeping into over-pumped ground near the sea, and ground sinking under a big city (Bangkok).
- Floods that follow the land (the heights are in the province maps already).
- The query tool showing a tile's groundwater.
