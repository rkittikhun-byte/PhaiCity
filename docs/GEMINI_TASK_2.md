# Gemini task 2: many crops in the farm zone, by province and soil

(owner, 24 Oct 2026: "ฟาร์ม ไม่ได้ไม่แค่นาข้าวนะ จะมีพืชหลายอย่างสลับกันไป" and "แต่ละพื้นที่ ก้ปลูกได้ไม่เหมือนกัน เพราะดิน
ต่างกัน อย่างทุเรียน ก้จะมีพื้นที่ จำกัดเฉพาะ"; "ให้ Gemini ทำเป็นงานที่ 2 หลังงานแรกผ่าน".)

**Start only after task 1 (`gemini/farm-bends`) has been merged into `main`**, from the `main` that has it, because both
change `src/render3d/city/farmFields.ts`:
`git worktree add .claude/worktrees/gemini-2 -b gemini/farm-crops main`

## Read first

`GEMINI.md`, `CLAUDE.md` (Farm zone, Province rules), **`docs/GAME_DESIGN.md` section 7.6 (the design: it is the spec, read
every point)** and 7.1-7.5, `src/farmZone.ts` (`pickKind`, `FarmKind`), `src/farmGrid.ts` (the road-aligned cells: each
cell knows its line, its row and its place along the line), `src/render3d/city/farmFields.ts` (the props: `crop rows`,
`orchard trees`, `cropHeight`, `paddyColour`), `src/provinceRules.ts` (`FARM_ZONE`, how a layer is checked and merged),
`data/province-rules.json`, `src/inspect.ts` and `src/hoverTip.ts` (what the card and tooltip say), `src/theme/tokens.ts`
(`farm`), `docs/STYLE_GUIDE.md`, `docs/3d/DETAIL_CHECKLIST.md`.

## What to do

1. **Crops as data** (`src/provinceRules.ts`, `data/province-rules.json`): `farmZone.crops`, one entry per crop of 7.6
   point 1, each with its kind (paddy, field, orchard, pond), a weight 0-1 and what land it likes (from the inputs of
   point 3: height above water, slope, the ground's water, distance to water, distance to town). The game's defaults,
   then the region's, then the province's, checked like the other `farmZone` numbers (a wrong value is refused, not
   guessed). Weight 0 means it is not grown there: durian and mangosteen only in the provinces 7.6 point 2 names, rubber
   and oil palm mostly south and east, shrimp only on the coast. Khon Kaen as point 8. Add the new keys to the file's
   `_note`.
2. **One pure function** (new `src/farmCrops.ts`, PhaiCity header, no DOM, no `window`, no `Math.random`): the crop of a
   grown field cell, from its kind, its family plot (point 4: 5-8 cells along the line, the width from a hash of the map
   seed and the plot's place; 11 rows deep from the line), the land there and the province's resolved table: the plot's
   crop is a weighted pick by score with a hash of (map seed, line, plot index along it, depth band). Same map, same crop
   every time; no new saved field; nothing the simulation counts changes (point 7, first step: no `SIM_VERSION` bump).
3. **The look** (`src/render3d/city/farmFields.ts`): each crop drawn by its season as point 5 says, instanced, **one draw
   call per crop shape** (not per field), low-poly near the camera and hidden as now beyond the far distance, where the
   field is only its ground colour (a different ground tint per crop is fine and cheap). New colours only as tokens under
   `farm` in `src/theme/tokens.ts`, then `npm run theme:css`. No new textures, no glb files. Cane burns with the paddies'
   months only where `burns` is on (the haze logic stays as it is).
4. **The words** (`docs/i18n/UI_STRINGS.md`, then `npm run i18n:import`; never edit `src/i18n/strings.ts`): a key per crop,
   `farm.crop.<id>`, in Thai and English, and the card and tooltip say the crop with the kind, e.g. "ไร่ข้าวโพด ระดับ 3" /
   "Maize field, level 3" (`src/inspect.ts`, `src/hoverTip.ts`: only the lines that name a field).
5. **Tests** (new `test/farmCrops.ts`, and `test/farmGrid.ts` if needed): the same map gives the same crops twice; Khon Kaen
   grows no durian anywhere; Chanthaburi grows durian somewhere on good, not low ground; a plot is one crop across its
   cells; neighbouring plots differ in at least a third of the pairs on a long road; a weight-0 crop is never picked; a
   wrong rule value is refused. `test/theme.ts` and `test/i18n.ts` pass.
6. **Look at it** (Playwright, headless, muted, your own dev server on a free port, stopped after): Mueang Khon Kaen with a
   farm zone painted on both sides of a road, grown (use the auto player or a test city), in the rainy season and the dry
   season: two or three screenshots (one on a tight bend: since task 1 a row's cells stretch to meet on a bend, and the crop
   rows and trees must fill those stretched cells too, not only each cell's own 4 m square), and the draw calls and frame time before and after
   (`renderer.info.render.calls`). It must stay smooth on integrated graphics: no more than about 12 extra draw calls.

## Only these files

`src/farmCrops.ts` (new), `src/render3d/city/farmFields.ts`, `src/provinceRules.ts` (the `farmZone.crops` part only),
`data/province-rules.json` (the `farmZone` parts and `_note`), `src/theme/tokens.ts` (`farm` only) and `css/theme.css`
(generated), `docs/i18n/UI_STRINGS.md` and `src/i18n/strings.ts` (generated), `src/inspect.ts` and `src/hoverTip.ts`
(the field lines only), `test/farmCrops.ts` (new), `test/farmGrid.ts`, and a short "built" note under
`docs/GAME_DESIGN.md` 7.6. Nothing else; no simulation file, not `src/farmZone.ts`. If the admin page cannot edit the new
table, say so in your report instead of changing it.

## Done when

`npx jest -c scripts/jest-worktree.cjs --maxWorkers=2 test/farmCrops.ts test/farmGrid.ts test/farmCells.ts test/theme.ts test/i18n.ts test/provinceRules.ts`
passes (run only the ones that exist), the screenshots and draw-call numbers are in your report, and the branch
`gemini/farm-crops` is committed and clean. Report as `GEMINI.md` says.
