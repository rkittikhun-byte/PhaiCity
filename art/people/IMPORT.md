# How to bring these people into the PhaiCity game

For the AI session (or person) that imports the people later. Nothing here has been imported yet (owner, 19 Oct
2026: build and keep first). Read the game's `CLAUDE.md`, `docs/3d/MODEL_SPEC.md` and `docs/3d/HOW_TO_MAKE_3D.md`
first; this file only covers what is special about these models.

## What is here

| Path | What |
|---|---|
| `blend/<sheet>/<id>.blend` | The source of one character, with its studio. Edit here. |
| `glb/<sheet>/<id>.glb` | The same character as glTF binary, made by `scripts/build.py`. Import these. |
| `previews/<sheet>/<id>.png`, `previews/<sheet>_sheet.png` | Renders to compare with the concept sheets. |
| `glb/clips.glb` | One plain person with all 21 activity clips as glTF animations named after the clip. |
| `clips.json`, `blend/clips.blend` | The same clips as numbers, and a demo person per clip (with its prop) to play in Blender. |
| `people-library.blend` | Every character in one file, as assets (Blender's Asset Browser). |
| `scripts/` | Python for Blender that makes everything. Rebuild with `scripts/build.py`. |
| `LOCKED.txt` | Characters edited by hand in Blender: their glb is exported from the .blend, never rebuilt. |

Sheets: `shared` (monk, yoke vendor, schoolboy, schoolgirl: on every sheet), `era1`..`era5`, `north`, `isan`,
`central`, `east`, `west`, `south`. PLAN.md lists every id.

## The glb files

- glTF is Y up: the character faces **+Z** in three.js (Blender's -Y), its feet at y = 0, units metres. Adult
  height about 1.5 m, child about 1.33 m.
- Nodes (the same names on every character): `<id>` (root) → `body` (origin at the hips) → `head` (neck),
  `arm_R`/`arm_L` (shoulders) → `forearm_R`/`forearm_L` (elbows, hands included, one-hand props as children),
  `prop_*`; root → `leg_R`/`leg_L` (hips) → `shin_R`/`shin_L` (knees, feet included), `prop_*` standing beside.
  Each node's local rotation is its pose; rotating it about its origin moves that part like a joint.
- Activity clips: `glb/clips.glb` has 21 animations (idle, walk, walk_carry, run, bike, plant_rice, harvest, hoe,
  water, pick, takraw, football, sit, sit_floor, sweep, cast_net, paddle, talk, wave, wai, sell), every part keyed
  in every clip. They target nodes by name, so `AnimationMixer` plays them on any character glb; for instanced
  people, sample a clip into per-part rotations once and drive the instances (as `pedestrians.ts` swings its
  boxes). A clip replaces the character's own pose: characters whose hands hold something
  (`phaicity_swing_arms` false) should play `walk_carry` (legs only). `clips.json` says each clip's prop and loop.
  Walk moves about 0.85 m a cycle (1 s), run about 1.9 m (0.67 s): move the root at that speed so feet do not slide.
- Materials are named `pc_<colour>` (`scripts/lib/palette.py`), a base colour only, double sided. The ink outline
  of the previews is a Solidify modifier and is **not** in the glb.
- Extras on the root: `phaicity_kind` (man, woman, boy, girl), `phaicity_label_th`, `phaicity_sheet`,
  `phaicity_swing_arms` (false when the hands hold something), `phaicity_triangles`.

## Steps for the import (suggested)

1. Copy the chosen `glb/` files into the game as `assets/models/people/<sheet>/<id>.glb` (GPL v3, made for this
   project: no credit line needed beyond the game's own). Keep `.blend` files out of the game repo, or add them
   with Git LFS if the owner wants them versioned there.
2. Load them with three.js `GLTFLoader` once at start (lazy, like the lazy PBR materials), never per pedestrian.
3. **Performance first**: the game draws up to about 140 walking people (`src/render3d/city/pedestrians.ts`).
   - Merge each character's meshes **per part** (body+head, arm_R, forearm_R, arm_L, forearm_L, leg_R, shin_R,
     leg_L, shin_L; props into their part) with
     `BufferGeometryUtils.mergeGeometries`, turning `pc_*` materials into vertex colours, so a character is 9 meshes
     and one material.
   - Draw every part as an `InstancedMesh` per character type, as `pedestrians.ts` does now with its boxes; the
     walking swing is the part's rotation about its origin, the same maths as `LIMB_PIVOT_Y` there.
   - Make a lighter LOD for far people (decimate to about 600 triangles, or the old box people) and switch by
     distance.
   - Map the colours to the game's toon look (`assets/review/3d-recommendation.md`: `MeshToonMaterial`, warm sun,
     lavender shadows) and the outline the renderer uses for buildings.
4. Scale: the city tile is 16 m (`HUMAN_HEIGHT_M` in `pedestrians.ts`); keep people at their real ~1.5 m so they sit
   right beside buildings and vehicles.
5. Choosing who walks where: by the city's era and region (the game has no era system yet: ask the owner how an era
   is reached, e.g. by ruler rank), by the zone (farmers near farms, office people in shops), with the shared
   characters everywhere. Plays activity clips from `clips.json` at the places they belong (paddy fields, gardens,
   sports grounds, roads).
6. Tests: a Jest test under `test/render3d/` that loads every glb, checks the node names and the triangle budget.
7. The renderer only reads city state (CLAUDE.md "Online plan").

## Changing a character

- Small change for everyone (a colour, a hair style, the head size): edit `scripts/lib/*`, rebuild with
  `blender -b --factory-startup --python-exit-code 1 -P scripts/build.py -- all --force`.
- One character by hand: open its `.blend`, edit, save, add its id to `LOCKED.txt`, run `build.py -- <id>` to export
  its glb again.
