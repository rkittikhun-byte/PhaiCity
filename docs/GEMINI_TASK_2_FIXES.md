# Gemini task 2, fixes before merge (ไม้ไผ่พ่อ's review, 24 Oct 2026)

Work on the same branch and worktree: `.claude/worktrees/gemini-2`, `gemini/farm-crops`. Commit the fixes on top; never
push or merge. The tests pass and the look is a good start; these must change first.

1. **The crop table must come from the data, not from code.** `src/farmCrops.ts` keeps its own copy of the regions' and
   provinces' crops (`REGION_CROPS`, `PROVINCE_CROPS`) and works out the region from the province code (`inferRegion`),
   and the 3D view, the card and the tooltip call it with the map alone, so the copy in code is what the game uses and
   `data/province-rules.json` (which the owner edits in the admin page) is not. CLAUDE.md: "Never hard-code a regional
   number in code". Fix:
   - delete `REGION_CROPS`, `PROVINCE_CROPS` and `inferRegion`; keep the regions' and provinces' crops only in
     `data/province-rules.json` (check that every number of the deleted tables is there);
   - the game already resolves the province's rules (`simulation.rules.farmZone`, see `src/game.js` around line 1498 and
     `src/splashScreen.js`): give the resolved crop table to the map once when a city starts or loads, as
     `map.farmZone` (the field `CropMap` already reads), and in `CityCore` the same way for tests and the auto player.
     That is the only change allowed outside the task's files; list it in your report. With no rules, the game's defaults
     (`FARM_CROPS`).
   - a test: a province layer in the rules that sets `durian.weight` is what `fieldCropAt` uses.
2. **The tooltip must not edit translated text.** `formatTooltip` in `src/hoverTip.ts` tests for `/^Level\b/` and rewrites
   the word. Add one i18n key instead, `farm.crop_level` ("{crop}, level {level}" / "{crop} ระดับ {level}") in
   `docs/i18n/UI_STRINGS.md`, run `npm run i18n:import`, and build the line from it (CLAUDE.md: never compare against
   displayed text).
3. **A plot's crop must not change with the season or after a reload.** `soilAt` reads the ground's water now
   (`ground.stores`, which the pumps and the dry season move) and caches it per map, so the same plot can get another
   crop after a reload or as the town grows. Use the ground's natural water (`ground.natural`, or the estimate when there
   is none) and leave out anything the player changes month to month, except the town distance, which is read once when
   the field first grows: keep it stable by measuring "town" from the ruler's house or `gameMap.town` (the town centre)
   instead of the nearest building. Test: change `ground.stores` and add a building near a plot; its crop stays.
4. **Report the draw calls and frame time** before and after (the task asked for it; no more than about 12 extra draw
   calls), measured on Mueang Khon Kaen, the real city map (`index.html?khonkaen`), not a test map.

Done when the task's test command passes again with the new tests, and your report lists each fix.
