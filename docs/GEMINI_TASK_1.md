# Gemini task 1: no slivers of grass between the farm fields' cells on a bend

(owner, 24 Oct 2026: "ลองเอางานให้ gemini 3.8 ลองสักงาน แล้วแกก็ตรวจอีกที": a first, small, self-contained job, to see how
Gemini works on this project.)

## Read first

`GEMINI.md`, `CLAUDE.md` (Farm zone), `docs/GAME_DESIGN.md` section 7 (the farm zone; 7.5 road-aligned cells),
`docs/NO_GRID_PLAN.md` row 3C, `src/render3d/city/farmFields.ts` (the cells' drawing, around lines 380-430: `patch`, `grow`,
`CELL_GROW`), `src/farmZone.ts` and `test/farmGrid.ts`.

## The problem

The farm zone's cells are 4 m squares laid in rows along the nearest road or canal, turned with it (ไม้ไผ่41). On a **bend**
the rows further from the road lie on a longer arc: the square cells of such a row fan apart on the outside of the bend and
leave thin wedge-shaped slivers of bare grass between neighbouring cells, which spoil the look of a field (a field should be
one smooth shape, its edge following the road). Each cell is already grown a little (`CELL_GROW`) to hide the smallest gaps;
that is not enough on a tight bend or in the deepest rows (33 rows, 132 m).

## What to do

1. Reproduce it: a farm zone painted on a curved road (the fixtures in `test/farmGrid.ts`, or a small map built in a test),
   and measure the uncovered area between painted neighbouring cells of one field (sample the quads' union on a fine grid).
2. Fix it in the drawing only (`src/render3d/city/farmFields.ts`; the painted cells and the simulation must not change): for
   painted neighbours in the same row, close the gap by drawing a connecting quad between the facing edges of the two cells
   (join their corners), or by stretching each cell's side edges to meet its neighbour's, so that a field is one continuous
   surface across a bend, with the dike (where the field ends) still following the field's real outer edge. No z-fighting
   between cells and joins: use the same lift and colour. Keep the vertex count small (the 3D view must stay smooth on
   integrated graphics: a field of 2,000 cells must not cost more than about 25% more vertices than now).
3. Add tests to `test/farmGrid.ts` (or one new file `test/render3d/farmBend.test.ts`): on a bend of radius about 30 m, with a
   field 40 rows deep, the uncovered fraction between a row's neighbours is under 0.5% (record the "before" number in your
   report), and on a straight road the geometry is the same as before.
4. Look at it in the browser: a farm zone on a curved road before and after (two screenshots, same view).

## Only these files

`src/render3d/city/farmFields.ts`, `test/farmGrid.ts` (or the one new test file named above), and a short note in
`docs/GAME_DESIGN.md` section 7.5. Nothing else. Do not touch the simulation or `src/farmZone.ts`.

## Done when

`npx jest -c scripts/jest-worktree.cjs --maxWorkers=2 test/farmGrid.ts test/farmCells.ts test/theme.ts` passes, the numbers
above are in your report, and your branch `gemini/farm-bends` is committed and clean. Report as `GEMINI.md` says.
