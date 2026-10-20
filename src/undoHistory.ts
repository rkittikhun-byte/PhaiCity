/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Undo (ย้อนกลับ) for building mistakes: each step is what one stroke of a tool changed (a click, a drag of road,
// a dragged area of zones), as the tiles before and after, and what it cost. Undoing puts the tiles back as they
// were and gives the money back. Only recent steps can be undone, so a zone cannot be built, grown for years and
// then refunded. Plain data, no DOM: it lives in CityCommands (src/cityCommands.ts).

export interface TileChange {
  x: number;
  y: number;
  /** The tile's raw value (value and flags) before and after. */
  before: number;
  after: number;
}

export interface UndoStep {
  /** The stroke the step belongs to (one press of the mouse), or null for a lone command. */
  stroke: number | null;
  changes: TileChange[];
  cost: number;
  /** The simulation's cityTime when the step was made (4 a month). */
  time: number;
  /** What else the step changed, each taken back by its function on undo, last first: the roads as drawn
   * (src/roads/roadGraph.ts mark) */
  also?: Array<() => void>;
}

/** How many steps are kept. */
export const UNDO_STEPS = 30;
/** How long a step can be undone, in cityTime: two game months. */
export const UNDO_TIME = 8;

export class UndoHistory {
  private steps: UndoStep[] = [];

  /** Adds what a command changed; a command of the same stroke as the last step joins that step. */
  record(stroke: number | null, changes: readonly TileChange[], cost: number, time: number): void {
    if (changes.length === 0 && cost === 0) return;
    const last = this.steps[this.steps.length - 1];
    if (stroke !== null && last && last.stroke === stroke) {
      for (const change of changes) {
        // A tile changed twice in one stroke goes back to how it was before the first change
        const earlier = last.changes.find((c) => c.x === change.x && c.y === change.y);
        if (earlier) earlier.after = change.after;
        else last.changes.push({ ...change });
      }
      last.cost += cost;
      last.time = time;
      return;
    }
    this.steps.push({ stroke, changes: changes.map((c) => ({ ...c })), cost, time });
    if (this.steps.length > UNDO_STEPS) this.steps.shift();
  }

  /** Adds something else a stroke changes, taken back on undo by calling back(): to the stroke's step, or a step of
   * its own when it has none yet. */
  attach(stroke: number | null, back: () => void, time: number): UndoStep {
    const last = this.steps[this.steps.length - 1];
    if (stroke !== null && last && last.stroke === stroke) {
      (last.also ??= []).push(back);
      last.time = time;
      return last;
    }
    const step: UndoStep = { stroke, changes: [], cost: 0, time, also: [back] };
    this.steps.push(step);
    if (this.steps.length > UNDO_STEPS) this.steps.shift();
    return step;
  }

  /** The step undo would take next, if any */
  last(): UndoStep | undefined {
    return this.steps[this.steps.length - 1];
  }

  /** Whether the last step can still be undone at this time. */
  canUndo(time: number): boolean {
    const last = this.steps[this.steps.length - 1];
    return last !== undefined && time - last.time <= UNDO_TIME;
  }

  /** Takes the last step to undo, or null; steps too old are forgotten (all older ones are older still). */
  take(time: number): UndoStep | null {
    if (!this.canUndo(time)) {
      this.steps = [];
      return null;
    }
    return this.steps.pop() ?? null;
  }

  get size(): number {
    return this.steps.length;
  }
}
