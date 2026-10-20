/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time bar (src/timeControls.ts; owner, 20 Oct 2026): pause and 1x 2x 3x, each the game's speed command.

import { currentSpeed, setSpeed } from "../src/timeControls";

function game() {
  const commands: { type: "speed"; speed: number }[] = [];
  return { isPaused: false, defaultSpeed: 2, commands, applyCommand(c: { type: "speed"; speed: number }) { commands.push(c); } };
}
const noPage = { getElementById: () => null } as unknown as Document;

describe("time bar", () => {
  test("shows the speed the game runs at, 0 while paused", () => {
    const g = game();
    expect(currentSpeed(g)).toBe(2);
    g.isPaused = true;
    expect(currentSpeed(g)).toBe(0);
  });

  test("each button runs the game at its speed through the speed command, and pause keeps the speed to go on at", () => {
    const g = game();
    setSpeed(g, 3, noPage);
    expect(g).toMatchObject({ isPaused: false, defaultSpeed: 3 });
    setSpeed(g, 0, noPage);
    expect(g).toMatchObject({ isPaused: true, defaultSpeed: 3 });
    expect(currentSpeed({ ...g, isPaused: false })).toBe(3);
    setSpeed(g, 1, noPage);
    expect(g.commands.map(c => c.speed)).toEqual([3, 0, 1]);
    expect(g.commands.every(c => c.type === "speed")).toBe(true);
  });
});
