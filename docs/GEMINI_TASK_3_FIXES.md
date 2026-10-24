# Gemini task 3, fixes before merge (ไม้ไผ่พ่อ's review, 24 Oct 2026)

Same worktree and branch: `.claude/worktrees/gemini-3`, `gemini/hover-outline`; commit on top, never push or merge. Start
a new conversation (an old one costs much more).

**The main problem: the screenshots show no glow.** `khonkaen-hover-temple-day.png`, `-shop-night.png` and
`-road-field.png` show an empty stretch of Khon Kaen with one road and trees: no temple, no shop, no building and no cyan
outline anywhere. So the look was never checked, and the report's "measured on every kind of building" is not true. Fix
the code below, then check it for real.

0. **Outline the object the game already picked, not a guess from one tile.** Everything clickable is a `CityObject`
   (`src/objects/`, found by `core.objects.at(x, y)`); the hover pick (`src/hoverTarget.ts` `hoverTargetAt`, used in
   `Game.hoverOutline` and `Game.selectionOutline` in `src/game.js`) already knows which one it is: a building's anchor
   tile (`target.x`, `target.y`, class 0) and its rect (`shown.rect`), a road's path. Pass that object's tiles to the view
   (one field on `ToolHover`, e.g. `inspectTiles: {x, y, width, height}`) and take the meshes of every placement on those
   tiles, so a building of many tiles is outlined whole and nothing beside it is. **A new city has no buildings** (0
   people): to test, open a city with homes, shops, a factory and a temple (build them with the auto player
   `src/core/autoPlayer.ts`, or `CoreSetup.sandbox` and commands), never an empty map.
1. **Nothing may be rebuilt every frame.** `CityHoverOutline.update` runs each frame and each time disposes and builds again
   the lot's ground geometry (`groundQuads`), the road's edge geometry (`roadEdgeGeometry`, sampling the terrain) and the
   list of meshes (`chunks.objectMeshes`, a new `Matrix4` per placement). Build them only when the hovered object changes
   (keep a key: the tile index, the road path's length and ends, the card-open flag) or the chunk under it is rebuilt; per
   frame only the fade changes.
2. **No full-screen target may be made or freed when a hover starts or ends.** `sceneTarget(hoverActive)` makes the lens
   drop and recreate its full-resolution scene target with a depth texture every time the hover comes and goes, a stutter
   the owner will see at once. Either keep the depth texture whenever the lens is on at Medium and above (and say what it
   costs), or test visibility without the scene's depth (draw the mask with depth test against its own depth only, and
   accept that hidden parts glow at full strength), whichever is cheaper; measure both.
3. **The mask must be drawn after this frame's scene, not the last one's.** `renderMask` runs before `post.render`, so it
   compares against the previous frame's depth (and none on the first). Draw it inside `CityPost.render` after the scene
   pass, or pass a callback, so the glow never lags a frame behind the camera.
4. **At most 2 extra draw calls.** The mask is drawn with one `renderer.render` per part of the model; a building of many
   parts costs many calls. Merge the hovered object's parts into one geometry when the hover changes (point 1), or put them
   in one group in the mask scene and render the scene once.
5. **Check it for real** (Playwright, headless, muted, your own dev server on a free port, stopped after;
   `index.html?khonkaen`): first build or find buildings (the auto player, or a saved test city with homes, shops, a
   factory and a temple), move the camera to them, point at each (dispatch `pointermove` on the canvas at the building's
   screen position) and wait 300 ms before the screenshot. Three screenshots where the cyan glow is plainly visible round a
   building (one at night), one with the card open. Then the numbers: draw calls and frame time with no hover, with a
   hover, and the time of the frame in which a hover starts (it must not jump).
6. Tests for 1-4: `update` called twice with the same hover builds nothing the second time; starting and ending a hover
   never changes the lens's scene target; the mask is drawn with at most 2 draw calls for a 12-part model.

Done when the task's test command passes with the new tests and your report shows the screenshots and numbers of point 5.
