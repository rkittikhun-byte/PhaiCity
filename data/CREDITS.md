# PhaiCity map data credits

Every external data source used under `data/` is listed here (rules: `docs/geo/GEO_SPEC.md` section 3).

| Data | Files | Source | License | Obligations |
|---|---|---|---|---|
| Province boundaries | `data/geo/thailand-provinces.topo.json` | [Natural Earth](https://www.naturalearthdata.com/) 1:10m Cultural Vectors, Admin 1 – States, Provinces ([download](https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip)) | Public domain ([terms](https://www.naturalearthdata.com/about/terms-of-use/)) | None; credited as a courtesy: "Made with Natural Earth." |
| Province map centers | `data/geo/province-centers.json` | [OpenStreetMap](https://www.openstreetmap.org/) via the [Overpass API](https://overpass-api.de/): `admin_centre` members of province boundaries; "เกาะรัตนโกสินทร์" for Bangkok | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | Credit "© OpenStreetMap contributors"; derived data stays ODbL |
| Neighbor edges | `data/geo/neighbor-edges.json` | Computed from the centers above | ODbL 1.0 (derived from OpenStreetMap) | As above |
| Province starting maps | `data/maps/*.json` | OpenStreetMap via the Overpass API | ODbL 1.0 | As above; see `data/maps/LICENSE.md` |

`data/thailand-provinces.json` (names, regions and neighbor lists) was compiled by hand for this project.

The game must show "© OpenStreetMap contributors" and "Natural Earth" in its credits (GEO_SPEC section 11).
