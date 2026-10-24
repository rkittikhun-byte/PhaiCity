# Gemini task 3: a clear glowing outline on the building the pointer is on (like Cities: Skylines II)

(owner, 24 Oct 2026, with a screenshot of Cities: Skylines II, a college outlined in glowing cyan when pointed at: "เอาเม้าชี้
แล้วให้ สิ่งก่อสร้าง เป็นรอยสีแบบนี้ ให้เด่นชัด เหมือนภาพนี้".)

Own worktree and branch, from `main`: `git worktree add .claude/worktrees/gemini-3 -b gemini/hover-outline main`. Start a
new conversation for this task (do not continue an old one: it costs far more).

## Read first

`GEMINI.md`, `CLAUDE.md` ("Hover for everything", "Rendering", "Diorama lens", "Big cities"), `docs/3d/RENDERER_SPEC.md`
§8A and §8B, `docs/STYLE_GUIDE.md`, `src/hoverPick.ts`, `src/hoverTarget.ts`, `Game.updateHover` and the hover's outline
around `src/game.js` line 1083 (`inspect`, `inspectFade`), `src/cityView.ts` (`ToolHover`), `src/render3d/city/overlay.ts`
around line 500 (today's thin white edge on the ground), `src/render3d/city/postFx.ts`, `quality.ts`, `pools.ts`,
`eraBuildings.ts`, `chunks.ts` (how a building's meshes are drawn, often instanced, and how to find those of one object).

## What it should look like

In the screenshot the pointed-at building has a **bright cyan glow round its whole 3D silhouette** (roof, walls, the lot's
trees and courts too) and a cyan line round its lot on the ground, so it stands out at once from any distance; nothing else
on screen changes. Today PhaiCity draws only a thin, faint white edge on the ground, which is easy to miss.

1. **The silhouette glow** (new `src/render3d/city/hoverOutline.ts`): the meshes of the object the hover means (a building
   with its lot, a service, a temple, a farm hub; for a road or canal its stretch, as today's edge) are drawn once more into
   a small mask target (half or quarter resolution, only those meshes: for an instanced building, one copy with its
   instance's matrix), then a screen pass finds the mask's edge and adds a soft glow of 2-4 px outside it and a faint tint
   inside, over the finished picture (in `postFx.ts`, after tone mapping, so the colour stays true). Seen through other
   buildings it stays visible but dimmer (as in the screenshot).
2. **The ground line**: the lot's outline on the ground (today's `edgeStrips` in `overlay.ts`) in the same colour, a little
   wider (about 0.5 m) and bright.
3. **Motion**: it fades in and out with today's `inspectFade` (120 ms), never blinks; it follows the hover's own pick
   (nearest object within 16 px, the held one kept). When the object's card is open it stays on that object while the card
   is open, a little stronger.
4. **Colour**: one new token, `SCENE.hover` (a clear cyan that reads on green fields, red earth, water and at night) with
   `hoverGlow` strength, in `src/theme/tokens.ts`, then `npm run theme:css`. No other colours.
5. **Cost**: nothing at all is drawn when nothing is hovered. With a hover, at most 2 extra draw calls for the mask (plus the
   object's own meshes) and one screen pass, under 0.5 ms on integrated graphics at Medium. At Low quality, and when the
   lens is off (headless, failed), only the ground line (2.) is drawn.
6. **Never** write city state; the renderer only reads. No new `Math.random`.

## Only these files

`src/render3d/city/hoverOutline.ts` (new), `src/render3d/city/postFx.ts`, `src/render3d/city/overlay.ts`,
`src/render3d/city/index.ts` (wiring only), whichever of `pools.ts` / `eraBuildings.ts` / `chunks.ts` needs a small read-only
function "the meshes and matrices of the object at this tile", `src/theme/tokens.ts` (`SCENE.hover` only) and
`css/theme.css` (generated), `src/cityView.ts` and `src/game.js` only if the card-open state must reach the view (one field),
tests in `test/render3d/hoverOutline.test.ts` (new), and in `CLAUDE.md` the "Hover for everything" bullet's words "a thin
white edge" changed to the new look. Anything else: stop and say so in the report.

## Tests

`test/render3d/hoverOutline.test.ts`: no draw at all with no hover; the mask holds only the hovered object's meshes (an
instanced building gives one instance, not the whole pool); the fade follows `inspectFade`; Low quality draws only the
ground line; disposing frees the targets. `test/theme.ts`, `test/render3d/postfx.test.ts` (or the postFx tests that exist)
and the hover tests (`test/hoverPick.ts`, `test/hoverTarget.ts` if present) still pass.

## Look at it

Playwright, headless, muted, your own dev server on a free port (stopped after), `index.html?khonkaen`: point at a house, a
shop row, a factory, a temple, a road and a farm field, by day and at night; screenshots of three of them, and the frame time
and draw calls with and without a hover (`renderer.info.render.calls`).

## Done when

`npx jest -c scripts/jest-worktree.cjs --maxWorkers=2 test/render3d/hoverOutline.test.ts test/theme.ts` plus the postFx and
hover tests pass, the screenshots and numbers are in your report, and `gemini/hover-outline` is committed and clean.
Report as `GEMINI.md` says.
