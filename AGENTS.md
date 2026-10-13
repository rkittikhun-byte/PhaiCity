# AGENTS.md

This file is for Codex and other AI agents.

**The main project guide is `CLAUDE.md`. Read it in full before every task and follow every rule in it.**
It is the same file Claude Code uses, so there is only one set of rules.

## Your role: only what the owner asks

**Since 13 Oct 2026 Claude Code owns the whole project, graphics included** (the owner's decision after Codex
finished Prompt R5; "Work split" in `CLAUDE.md`). Codex takes no standing work and no queued prompt.

- **Only when the owner asks you for a specific task:** edit only the files that task names, on a branch of its own
  (never `main` directly), and list every file you changed in your report so Claude Code can review and merge it.
- **Shared files:** in `package.json`, `webpack.config.js`, `tsconfig.json`, `jest.config.cjs`, `.gitignore`, `CLAUDE.md` and `AGENTS.md`, make additive changes only, and list them in your report.
- If your task seems to need a change outside the files it names, stop and describe the needed change in your
  report instead.

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
   - Buddha images, and religious buildings other than Thai Buddhist temples, which are allowed as landmarks with
     their roof ornaments on temple buildings only (owner, 13 Oct 2026; spirit houses are fine)
6. External assets must be CC0 and recorded in `assets/CREDITS.md`.
   Map data comes only from Natural Earth and OpenStreetMap and is recorded in `data/CREDITS.md`.
