# AGENTS.md

This file is for Codex and other AI agents.

**The main project guide is `CLAUDE.md`. Read it in full before every task and follow every rule in it.**
It is the same file Claude Code uses, so there is only one set of rules.

## Your role: graphics only

**Codex owns graphics. Claude Code owns everything else.** The full table is in "Work split" in `CLAUDE.md`.

- **You may edit:** `src/render3d/**`, `assets/textures/**`, `assets/hdri/**`, `assets/icons/**`, `model-gallery.html`, `test/render3d/**`, `docs/3d/MODEL_STATUS.md`
- **Shared files:** in `package.json`, `webpack.config.js`, `tsconfig.json`, `jest.config.cjs`, `.gitignore`, `CLAUDE.md` and `AGENTS.md`, make additive changes only, and list them in your report.
- **Everything else is off-limits:** game logic, simulation, game UI and text, sound, `data/`, `scripts/`, `docs/` (except `MODEL_STATUS.md`).
  If your task seems to need a change there, stop and describe the needed change in your report instead.

The most important rules, summarized from `CLAUDE.md`:

1. Talk to the project owner in **Thai**. Code, comments and identifiers stay in English.
2. Never remove or edit existing license headers, and never delete `LICENSE`, `COPYING` or `MicropolisPublicNameLicense.md`.
3. Do not modify the city simulation (`src/*.js`, `src/*.ts` outside `src/render3d/`) unless explicitly asked.
   Keep it free of DOM / jQuery / `window`, and add no new `Math.random` calls (see "Online plan" in `CLAUDE.md`).
4. Read the spec before working in its area, and meet its Definition of Done:
   - 3D models: `docs/3d/MODEL_SPEC.md`. Every model supports the 6 regions through `opts.region`
     (tiers R1/R2/R3, section 6A).
   - Real geography and map data: `docs/geo/GEO_SPEC.md`.
5. Forbidden content:
   - real brands
   - the Garuda emblem or royal symbols
   - the Red Cross emblem
   - Buddha images and religious buildings of any faith (spirit houses are the only exception)
6. External assets must be CC0 and recorded in `assets/CREDITS.md`.
   Map data comes only from Natural Earth and OpenStreetMap and is recorded in `data/CREDITS.md`.
