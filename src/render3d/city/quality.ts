/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// How much of the diorama lens (postFx.ts) the city view draws, by the player's graphics setting (src/graphicsQuality.ts)
// and, in Auto, by how fast the frames come (docs/METRE_DRAWING_PLAN.md section 6; docs/3d/RENDERER_SPEC.md 8A).
//
// The effects stand on a ladder, the cheapest at the bottom: the tilt-shift (rung 1), then the glow (rung 2), then the
// contact shadows with four samples a pixel for the sharpest edges (rung 3). Low draws none of them, only smoothing the
// edges; Medium the first two, which a notebook with integrated graphics keeps near 60 frames a second; High all
// three. Auto starts at Medium; when frames are slow it gives up the costliest first (contact shadows, then glow, then
// tilt-shift) before the view lowers its resolution and its draw budget, and when they are fast again it takes them
// back in the other order, last of all.
// This file has no three.js in it, so the ladder is tested in Node (test/render3d/postfx.test.ts).

/** The player's graphics setting, saved per viewer (src/graphicsQuality.ts) */
export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[] = ['auto', 'low', 'medium', 'high'];

/** Which effects of the diorama lens are on */
export interface PostEffects { ao: boolean; bloom: boolean; tiltShift: boolean }
export const NO_EFFECTS: Readonly<PostEffects> = Object.freeze({ ao: false, bloom: false, tiltShift: false });

/** Each rung's effect, from the bottom: rung n has the first n of these on */
export const LADDER = ['tiltShift', 'bloom', 'ao'] as const;
export type Effect = typeof LADDER[number];

/** The rung each setting stands on (Auto starts on Medium's and moves) */
export const LEVEL_RUNG: Record<GraphicsQuality, number> = { auto: 2, low: 0, medium: 2, high: 3 };
/** The most the view's resolution may be raised over the screen's, by setting: Low stays at the screen's own */
export const LEVEL_PIXEL_RATIO: Record<GraphicsQuality, number> = { auto: 1.25, low: 1, medium: 1.25, high: 1.25 };

export function isGraphicsQuality(value: unknown): value is GraphicsQuality {
  return typeof value === 'string' && (GRAPHICS_QUALITIES as readonly string[]).includes(value);
}

/** The effects on at a rung */
export function effectsAt(rung: number): PostEffects {
  return { tiltShift: rung >= 1, bloom: rung >= 2, ao: rung >= 3 };
}

/**
 * What an effect costs the graphics card, in milliseconds a frame, until the view has measured it: a notebook with
 * integrated graphics at 1080p (docs/3d/RENDERER_SPEC.md 8A has the measured numbers)
 */
export const EFFECT_COST_GUESS: Record<Effect, number> = { tiltShift: 0.8, bloom: 0.8, ao: 3.5 };

/** Frames slower than this, in milliseconds on the processor or the graphics card, give up an effect in Auto */
export const EFFECT_SLOW_MS = 17;
/** ... and an effect comes back only if the frame with it would still take less than this */
export const EFFECT_ROOM_MS = 13.5;
/** Without a timer on the graphics card, frames that come further apart than this are slow (the screen's 60 a second
 * comes 16.7 ms apart) ... */
export const INTERVAL_SLOW_MS = 24;
/** ... and frames this close together have room */
export const INTERVAL_FAST_MS = 18;
/** How long frames must stay fast before an effect comes back, and how much longer each time it had to go again */
export const RAISE_WAIT_MS = 10000;
export const RAISE_WAIT_MAX_MS = 320000;

/** One look at how the frames are going, taken when the view has settled (index.ts paint) */
export interface FrameSample {
  /** Now, in milliseconds */
  now: number;
  /** The processor's time for a frame */
  cpuMs: number;
  /** The graphics card's time for a frame, when the browser can time it (gpuTimer.ts), else null */
  gpuMs: number | null;
  /** The middle of the times between frames */
  intervalMs: number;
}

/** The effect rungs: where the view stands, and what Auto has learned about each effect's cost */
export class EffectLadder {
  /** How many effects are on, counted from the bottom */
  rung: number;
  private setting: GraphicsQuality;
  /** Each effect's measured cost, when known */
  readonly cost: Record<Effect, number | null> = { tiltShift: null, bloom: null, ao: null };
  /** When an effect may come back, and how long it waits the next time it has to go again */
  private retryAt: Record<Effect, number> = { tiltShift: 0, bloom: 0, ao: 0 };
  private wait: Record<Effect, number> = { tiltShift: RAISE_WAIT_MS, bloom: RAISE_WAIT_MS, ao: RAISE_WAIT_MS };
  /** The last change, to measure what it saved or cost once fresh frames come */
  private pending: { effect: Effect; gpuBefore: number | null; raised: boolean; at: number } | null = null;
  /** Since when frames have had room for the next effect */
  private roomSince: number | null = null;

  constructor(setting: GraphicsQuality = 'auto') {
    this.setting = setting;
    this.rung = LEVEL_RUNG[setting];
  }

  get quality(): GraphicsQuality { return this.setting; }
  get auto(): boolean { return this.setting === 'auto'; }
  get effects(): PostEffects { return effectsAt(this.rung); }
  /** The effect the next drop gives up, or the next raise takes back */
  get top(): Effect | null { return this.rung > 0 ? LADDER[this.rung - 1] : null; }
  get next(): Effect | null { return this.rung < LADDER.length ? LADDER[this.rung] : null; }

  /** The player chose another setting: stand on its rung and start learning afresh */
  set(setting: GraphicsQuality): void {
    this.setting = setting; this.rung = LEVEL_RUNG[setting]; this.pending = null; this.roomSince = null;
    for (const effect of LADDER) { this.retryAt[effect] = 0; this.wait[effect] = RAISE_WAIT_MS; }
  }

  /** Whether frames this slow should give up an effect (Auto only, and only one that is on) */
  slow(sample: FrameSample): boolean {
    if (!this.auto || this.rung === 0) return false;
    const gpu = sample.gpuMs;
    // A frame held up by the processor while the graphics card idles is not helped by giving up an effect
    if (gpu !== null && sample.cpuMs > EFFECT_SLOW_MS && gpu < sample.cpuMs * 0.5) return false;
    if (Math.max(sample.cpuMs, gpu ?? 0) > EFFECT_SLOW_MS) return true;
    return gpu === null && sample.intervalMs > INTERVAL_SLOW_MS;
  }

  /** Gives up the top effect, remembering when, so its cost can be measured and it does not come straight back */
  drop(sample: FrameSample): Effect | null {
    const effect = this.top; if (!effect) return null;
    // An effect that had just come back and made the frames slow waits twice as long the next time
    if (this.pending?.raised && this.pending.effect === effect) this.wait[effect] = Math.min(RAISE_WAIT_MAX_MS, this.wait[effect] * 2);
    this.rung--; this.retryAt[effect] = sample.now + this.wait[effect]; this.roomSince = null;
    this.pending = { effect, gpuBefore: sample.gpuMs, raised: false, at: sample.now };
    return effect;
  }

  /** Fresh frames after a change: how much the change saved (or cost) on the graphics card */
  measure(sample: FrameSample): void {
    const p = this.pending; if (!p || sample.now <= p.at || p.gpuBefore === null || sample.gpuMs === null) return;
    const difference = p.raised ? sample.gpuMs - p.gpuBefore : p.gpuBefore - sample.gpuMs;
    this.cost[p.effect] = Math.max(0.1, difference);
    // A drop is measured once; a raise stays pending until the next decision, so a slow one waits longer
    if (!p.raised) this.pending = null;
  }

  /** Whether the next effect may come back now (Auto only): frames have had room for it for a while */
  room(sample: FrameSample): boolean {
    const effect = this.next;
    if (!this.auto || !effect || sample.now < this.retryAt[effect]) { this.roomSince = null; return false; }
    const gpu = sample.gpuMs, cost = this.cost[effect] ?? EFFECT_COST_GUESS[effect];
    const fits = sample.cpuMs < EFFECT_ROOM_MS && (gpu !== null ? gpu + cost < EFFECT_ROOM_MS : sample.intervalMs < INTERVAL_FAST_MS);
    if (!fits) { this.roomSince = null; return false; }
    if (this.roomSince === null) this.roomSince = sample.now;
    return sample.now - this.roomSince >= RAISE_WAIT_MS;
  }

  /** Takes the next effect back */
  raise(sample: FrameSample): Effect | null {
    const effect = this.next; if (!effect) return null;
    this.rung++; this.roomSince = null;
    this.pending = { effect, gpuBefore: sample.gpuMs, raised: true, at: sample.now };
    return effect;
  }

  /** The raise has held through a decision without slowing the frames: it waits no longer next time */
  settled(): void {
    if (this.pending?.raised) { this.wait[this.pending.effect] = RAISE_WAIT_MS; this.pending = null; }
  }
}

/** The middle of a list of times, leaving out the gaps of a hidden page or an open dialog (over 250 ms) */
export function middleInterval(intervals: readonly number[]): number {
  const kept = intervals.filter(value => value > 0 && value < 250).sort((a, b) => a - b);
  return kept.length ? kept[Math.floor(kept.length / 2)] : 0;
}
