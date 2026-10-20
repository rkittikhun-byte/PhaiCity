/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// How long the graphics card takes over a frame, where the browser can time it (EXT_disjoint_timer_query_webgl2).
// The processor's time for a frame (index.ts frameMs) misses the effects of the diorama lens, which the graphics card
// runs after the frame's JavaScript is done, so the adaptive quality (quality.ts) reads this too. A query's answer
// comes a frame or two later; the timer never waits for one, so it never stalls the frame.

interface TimerQueryExtension { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }

/** Frames timed at once, waiting for their answers */
const IN_FLIGHT = 4;
/** How many answers the average is over */
const KEPT = 30;

export class GpuTimer {
  /** The average time of the last frames the card answered for, or null before any */
  ms: number | null = null;
  private free: WebGLQuery[] = [];
  private waiting: WebGLQuery[] = [];
  private running: WebGLQuery | null = null;
  private times: number[] = [];
  private constructor(private readonly gl: WebGL2RenderingContext, private readonly ext: TimerQueryExtension) {}

  /** A timer for this context, or null where the browser has none */
  static create(gl: unknown): GpuTimer | null {
    try {
      const context = gl as WebGL2RenderingContext | null;
      if (!context || typeof context.getExtension !== 'function' || typeof context.createQuery !== 'function') return null;
      const ext = context.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExtension | null;
      return ext ? new GpuTimer(context, ext) : null;
    } catch {
      return null;
    }
  }

  /** Starts timing a frame, unless too many are still waiting for their answers */
  begin(): void {
    if (this.running || this.waiting.length >= IN_FLIGHT) return;
    const query = this.free.pop() ?? this.gl.createQuery();
    if (!query) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query); this.running = query;
  }

  end(): void {
    if (!this.running) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.waiting.push(this.running); this.running = null;
  }

  /** Reads the answers that have come, oldest first, without waiting for the rest */
  poll(): void {
    const gl = this.gl;
    // A disjoint (the card's clock jumped: power saving, another program) spoils every answer in flight
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.waiting.length) {
      const query = this.waiting[0];
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      this.waiting.shift();
      if (!disjoint) {
        const ns = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
        this.times.push(ns / 1e6); if (this.times.length > KEPT) this.times.shift();
      }
      this.free.push(query);
    }
    if (this.times.length) this.ms = this.times.reduce((a, b) => a + b, 0) / this.times.length;
  }

  /** Forget the old answers, after the view changed what it draws */
  reset(): void { this.times = []; this.ms = null; }

  dispose(): void {
    if (this.running) { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); this.waiting.push(this.running); this.running = null; }
    for (const query of [...this.free, ...this.waiting]) this.gl.deleteQuery(query);
    this.free = []; this.waiting = [];
  }
}
