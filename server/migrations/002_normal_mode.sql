-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
-- Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

-- Every online city plays the normal mode, so every province of a world plays by one rule (docs/GAME_DESIGN.md 6.3):
-- a save whose game level (the game's Simulation level, _gameLevel) is not 1 is refused. The API checks it first
-- (src/validate.ts saveBody); test/memoryStore.ts keeps the same rule.
ALTER TABLE city_saves ADD CONSTRAINT city_saves_normal_mode CHECK (data -> '_gameLevel' = '1'::jsonb);
