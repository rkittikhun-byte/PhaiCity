# GEMINI.md

This file is for Gemini and other AI agents that read `GEMINI.md`.

**The main project guide is `CLAUDE.md`. Read it in full before every task, then `docs/HANDOFF.md`, and follow every rule
in them.** It is the same file Claude Code and Codex use, so there is only one set of rules (`AGENTS.md` has the summary of
the rules for helpers).

## Your role: one task at a time, on a branch of your own

- The owner gives you a specific task (a file `docs/GEMINI_TASK_<n>.md`). Work **only on that task**, in a git worktree
  and branch of your own (never on `main`, never in the main folder's checkout):
  `git worktree add .claude/worktrees/gemini-<n> -b gemini/<name> main`
- Edit only the files the task names. If it seems to need a change elsewhere, stop and describe it in your report.
- **Never push, never merge, never delete anything outside your worktree.** Claude Code (ไม้ไผ่พ่อ) reviews your branch,
  runs the tests, and merges it. Commit in small pieces with English messages in the repo's style.
- Talk to the owner in **Thai** (call them เจ้านาย); code, comments, identifiers and commit messages in English.

## Running tests in a worktree (do this; do not copy or link node_modules)

From inside your worktree:

```bash
npx jest -c scripts/jest-worktree.cjs --maxWorkers=2 <test files>
```

`scripts/jest-worktree.cjs` uses the current folder as the project and the main folder's `node_modules`
(`PHAICITY_MAIN`, default `D:/DesktopServer/www/phaicity`). **Never** `mklink`/junction `node_modules` into a worktree
(removing the worktree would empty the real one). Always `--maxWorkers=2`, never a whole suite without that limit, and run
only the suites your change touches (the full suite takes 20 minutes and a lot of RAM: Claude Code runs it at merge). The
2 failures in `test/bounds.ts` are known and not yours.

## The rules that matter most (the full list is in `CLAUDE.md` and `docs/design/LOOK_BOOK.md`)

1. The owner's taste: a clean screen, nothing pops up uninvited, small type, nothing bold; what you see is what is there;
   no grid, staircase or odd patch on the ground; calm pace; light on a notebook with integrated graphics.
2. Colours only from `src/theme/tokens.ts` (`test/theme.ts` rejects any new hard-coded colour and counts them per folder).
3. UI text only through i18n keys: edit `docs/i18n/UI_STRINGS.md`, then run `npm run i18n:import`; never edit
   `src/i18n/strings.ts` by hand.
4. Do not modify the city simulation (`src/*.js`, `src/*.ts` outside `src/render3d/`) unless the task says so; it must stay
   free of DOM and `window`, with no new `Math.random` (use `Random`, `src/random.ts`); the same seed and commands must
   make the same city.
5. The renderer only reads city state and never writes it back.
6. Never remove or edit license headers; new files get the PhaiCity header (see `docs/3d/MODEL_SPEC.md` section 8).
7. Never stop the owner's dev servers (ports 8080, 8082, 8099). Start your own on another port and stop it when done. The
   owner's machine is a notebook with shared RAM: one heavy process at a time, and stop what you started.
8. Test like a human hand, not a computer's: pointer a few pixels off, shaky drags. Check visual work in a browser
   (Playwright is installed in the main folder: `require('D:/DesktopServer/www/phaicity/node_modules/playwright')`,
   headless, muted) and keep screenshots few.

## Your report (English, then a short Thai summary for the owner)

The branch and its commits, every file you changed, the tests you ran and their results, what you saw in the browser
(screenshots' paths), what you could not check, and anything you think is wrong.
