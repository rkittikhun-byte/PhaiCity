/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */
// The diorama lens (src/render3d/city/postFx.ts) and the quality that chooses its effects (quality.ts): the levels, the
// order Auto gives effects up and takes them back in, and a headless view that never draws through the lens.
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { WebGLRenderer } from 'three';
import { CityView3D } from '../../src/render3d/city/index.js';
import type { CityPostLike, PostLook } from '../../src/render3d/city/postFx.js';
import { EFFECT_COST_GUESS, EffectLadder, LADDER, LEVEL_RUNG, RAISE_WAIT_MS, effectsAt, isGraphicsQuality, middleInterval,
  type FrameSample, type PostEffects } from '../../src/render3d/city/quality.js';
import type { CityViewSetup } from '../../src/render3d/city/types.js';
import { SCENE } from '../../src/theme/tokens.js';

const sample = (now: number, cpuMs: number, gpuMs: number | null, intervalMs = 16.7): FrameSample => ({ now, cpuMs, gpuMs, intervalMs });

describe('graphics levels', () => {
  it('Low draws no effect, Medium the glow and the tilt-shift, High the contact shadows too; Auto starts on Medium', () => {
    expect(effectsAt(LEVEL_RUNG.low)).toEqual({ ao: false, bloom: false, tiltShift: false });
    expect(effectsAt(LEVEL_RUNG.medium)).toEqual({ ao: false, bloom: true, tiltShift: true });
    expect(effectsAt(LEVEL_RUNG.high)).toEqual({ ao: true, bloom: true, tiltShift: true });
    expect(new EffectLadder('auto').effects).toEqual(effectsAt(LEVEL_RUNG.medium));
    expect(LADDER).toEqual(['tiltShift', 'bloom', 'ao']);
  });
  it('knows its settings and nothing else', () => {
    for (const q of ['auto', 'low', 'medium', 'high']) expect(isGraphicsQuality(q)).toBe(true);
    for (const q of ['ultra', '', null, 3, undefined]) expect(isGraphicsQuality(q)).toBe(false);
  });
});

describe('the effect ladder', () => {
  it('in Auto gives up the contact shadows first, then the glow, then the tilt-shift, and nothing after', () => {
    const ladder = new EffectLadder('auto'); ladder.rung = 3;
    const dropped: (string | null)[] = [];
    for (let i = 0; i < 4; i++) { const s = sample(i * 4000, 5, 25); if (ladder.slow(s)) dropped.push(ladder.drop(s)); }
    expect(dropped).toEqual(['ao', 'bloom', 'tiltShift']);
    expect(ladder.effects).toEqual({ ao: false, bloom: false, tiltShift: false });
    expect(ladder.slow(sample(20000, 5, 25))).toBe(false);
  });
  it('never changes a level the player chose', () => {
    for (const q of ['low', 'medium', 'high'] as const) {
      const ladder = new EffectLadder(q);
      expect(ladder.slow(sample(0, 40, 40, 60))).toBe(false);
      for (let t = 0; t <= 60000; t += 5000) expect(ladder.room(sample(t, 1, 1))).toBe(false);
      expect(ladder.effects).toEqual(effectsAt(LEVEL_RUNG[q]));
    }
  });
  it('keeps the effects when the processor holds the frame up and the graphics card idles', () => {
    const ladder = new EffectLadder('auto');
    expect(ladder.slow(sample(0, 30, 6))).toBe(false);
    expect(ladder.slow(sample(0, 30, 20))).toBe(true);
  });
  it('without a timer on the graphics card, reads frames that come far apart as slow', () => {
    const ladder = new EffectLadder('auto');
    expect(ladder.slow(sample(0, 5, null, 16.7))).toBe(false);
    expect(ladder.slow(sample(0, 5, null, 33))).toBe(true);
  });
  it('takes an effect back only after ten seconds with room for what it was measured to cost', () => {
    const ladder = new EffectLadder('auto'); ladder.rung = 3;
    ladder.drop(sample(0, 5, 20)); ladder.measure(sample(3000, 5, 12));
    expect(ladder.cost.ao).toBeCloseTo(8);
    // 6 + 8 would not leave room; 5 + 8 does, once it has for ten seconds and the effect's wait is over
    expect(ladder.room(sample(RAISE_WAIT_MS + 1000, 5, 6))).toBe(false);
    expect(ladder.room(sample(RAISE_WAIT_MS + 2000, 5, 5))).toBe(false);
    expect(ladder.room(sample(2 * RAISE_WAIT_MS + 1000, 5, 5))).toBe(false);
    expect(ladder.room(sample(2 * RAISE_WAIT_MS + 2000, 5, 5))).toBe(true);
    expect(ladder.raise(sample(2 * RAISE_WAIT_MS + 2000, 5, 5))).toBe('ao');
  });
  it('guesses what an effect it has not measured costs', () => {
    const ladder = new EffectLadder('auto');
    const roomFor = 13.5 - EFFECT_COST_GUESS.ao;
    expect(ladder.room(sample(0, 4, roomFor - 0.5))).toBe(false);
    expect(ladder.room(sample(RAISE_WAIT_MS, 4, roomFor - 0.5))).toBe(true);
    expect(new EffectLadder('auto').room(sample(RAISE_WAIT_MS, 4, roomFor + 0.5))).toBe(false);
  });
  it('waits twice as long each time an effect it took back made the frames slow again', () => {
    const ladder = new EffectLadder('auto');
    let t = 0;
    const slowAfterRaise = (): number => {
      // Room without a timer: frames close together
      let since = -1;
      for (; t < 10 * 60000; t += 1000) if (ladder.room(sample(t, 4, null, 16.7))) { if (since < 0) since = t; break; }
      ladder.raise(sample(t, 4, null)); const raisedAt = t;
      t += 3000; ladder.measure(sample(t, 4, null, 30)); expect(ladder.slow(sample(t, 4, null, 30))).toBe(true); ladder.drop(sample(t, 4, null, 30));
      return raisedAt;
    };
    const first = slowAfterRaise(), second = slowAfterRaise(), third = slowAfterRaise();
    expect(second - first).toBeGreaterThanOrEqual(2 * RAISE_WAIT_MS);
    expect(third - second).toBeGreaterThan(second - first);
  });
  it('starts afresh when the player chooses again', () => {
    const ladder = new EffectLadder('auto'); ladder.drop(sample(0, 5, 25));
    ladder.set('high'); expect(ladder.effects).toEqual(effectsAt(3)); ladder.set('auto'); expect(ladder.rung).toBe(LEVEL_RUNG.auto);
  });
  it('reads the middle of the frame times, leaving out the gaps of a hidden page', () => {
    expect(middleInterval([16, 17, 16, 5000, 18, 900])).toBe(17);
    expect(middleInterval([])).toBe(0);
  });
});

// --- The view ------------------------------------------------------------------------------------------------------

function mapReader(width = 200, height = 16) { return { width, height, getTileValue: () => 0, getTileFlags: () => 0 }; }

/** A stand-in for the lens, recording what the view asks of it */
function fakePost(): CityPostLike & { renders: number; looks: PostLook[]; sizes: [number, number][]; effectsLog: PostEffects[] } {
  const post = {
    effects: { ao: false, bloom: false, tiltShift: false } as PostEffects, renders: 0, looks: [] as PostLook[],
    sizes: [] as [number, number][], effectsLog: [] as PostEffects[],
    setEffects(effects: PostEffects) { post.effects = { ...effects }; post.effectsLog.push({ ...effects }); },
    setSize(width: number, height: number) { post.sizes.push([width, height]); },
    render(_scene: unknown, _camera: unknown, look: PostLook) { post.renders++; post.looks.push(look); },
    dispose: jest.fn(),
  };
  return post;
}

function viewFixture(options: { post?: ReturnType<typeof fakePost> | null; gpuMs?: number | null } = {}) {
  Object.defineProperty(globalThis, 'devicePixelRatio', { configurable: true, value: 2 });
  let time = 0, ratio = 2;
  const canvas = { style: { cssText: '' }, addEventListener: jest.fn(), removeEventListener: jest.fn(), remove: jest.fn(),
    toDataURL: () => 'data:image/png;base64,lens' } as unknown as HTMLCanvasElement;
  const renderer = { setPixelRatio: jest.fn((value: number) => { ratio = value; }), getPixelRatio: () => ratio, setSize: jest.fn(),
    shadowMap: {}, info: { autoReset: true, reset: jest.fn(), render: { calls: 3, triangles: 20 } }, render: jest.fn(), setRenderTarget: jest.fn(), dispose: jest.fn() } as unknown as WebGLRenderer;
  const container = { clientWidth: 800, clientHeight: 600, append: jest.fn() } as unknown as HTMLElement;
  const overlay = { blockSize: 2, worldGet: () => 0 };
  const setup: CityViewSetup = { container, map: mapReader(), region: 'central', overlays: { trafficDensityMap: overlay, pollutionDensityMap: overlay, landValueMap: overlay }, date: () => ({ month: 0, year: 2026 }) };
  const timer = options.gpuMs === undefined ? undefined : { ms: options.gpuMs, begin: jest.fn(), end: jest.fn(), poll: jest.fn(), reset: jest.fn(), dispose: jest.fn() };
  const post = options.post;
  const view = new CityView3D(setup, { canvas, rendererFactory: () => renderer, provider: { request: jest.fn(), take: () => [], dispose: jest.fn() },
    now: () => time, headless: true, postFactory: post === undefined ? undefined : () => post, gpuTimer: timer });
  view.chunks.finishMapLOD(); view.chunks.update = jest.fn();
  return { view, renderer, post, timer, setGpu(ms: number | null) { if (timer) timer.ms = ms; },
    frames(count: number, ms = 16) { for (let i = 0; i < count; i++) { time += ms; view.paint(null, null, true); } },
    adapting() { (view as unknown as { headless: boolean }).headless = false; }, get time() { return time; } };
}

describe('the 3D view without the lens', () => {
  it('headless, makes no lens, draws straight to the screen and reports every effect off, whatever the setting', () => {
    const f = viewFixture();
    try {
      expect(f.view.effects).toEqual({ ao: false, bloom: false, tiltShift: false });
      for (const q of ['high', 'medium', 'auto', 'low'] as const) {
        f.view.setQuality(q); expect(f.view.quality).toBe(q);
        expect(f.view.effects).toEqual({ ao: false, bloom: false, tiltShift: false });
      }
      const before = (f.renderer.render as jest.Mock).mock.calls.length; f.frames(3);
      expect((f.renderer.render as jest.Mock).mock.calls.length).toBe(before + 3);
      expect(f.renderer.info.autoReset).toBe(true);
      expect(f.view.screenshotVisible()).toMatch(/^data:image\/png/);
      expect(f.view.metrics.gpuMs).toBeNull();
    } finally { f.view.dispose(); }
  });
  it('ignores a setting it does not know', () => {
    const f = viewFixture();
    try { f.view.setQuality('high'); f.view.setQuality('ultra' as never); expect(f.view.quality).toBe('high'); } finally { f.view.dispose(); }
  });
  it('city sources keep the setting out of the view: it is saved by the game (src/graphicsQuality.ts)', () => {
    const source = readFileSync(resolve('src/graphicsQuality.ts'), 'utf8');
    expect(source).toContain('phaicity.graphics');
    for (const file of ['index.ts', 'postFx.ts', 'quality.ts', 'gpuTimer.ts']) {
      expect(readFileSync(resolve('src/render3d/city', file), 'utf8')).not.toMatch(/localStorage|requestAnimationFrame\s*\(/);
    }
  });
});

describe('the 3D view through the lens', () => {
  it('draws every level through the lens, Low only to smooth the edges, and the effects of each level', () => {
    const post = fakePost(), f = viewFixture({ post });
    try {
      expect(f.view.effects).toEqual(effectsAt(LEVEL_RUNG.auto));
      f.view.setQuality('high'); expect(post.effects).toEqual({ ao: true, bloom: true, tiltShift: true });
      let renders = post.renders; const direct = (f.renderer.render as jest.Mock).mock.calls.length;
      f.frames(2); expect(post.renders).toBe(renders + 2); expect((f.renderer.render as jest.Mock).mock.calls.length).toBe(direct);
      // The canvas's drawing size, the info counted over the frame's several draws
      expect(post.sizes[post.sizes.length - 1]).toEqual([1000, 750]); expect(f.renderer.info.autoReset).toBe(false);
      f.view.setQuality('low'); expect(post.effects).toEqual({ ao: false, bloom: false, tiltShift: false }); renders = post.renders;
      f.frames(2); expect(post.renders).toBe(renders + 2); expect((f.renderer.render as jest.Mock).mock.calls.length).toBe(direct);
      // Low stays at the screen's own resolution; the others may rise over it
      expect(f.renderer.getPixelRatio()).toBe(1); f.view.setQuality('medium'); expect(f.renderer.getPixelRatio()).toBe(1.25);
      expect(f.view.screenshotVisible()).toMatch(/^data:image\/png/);
    } finally { f.view.dispose(); }
    expect(post.dispose).toHaveBeenCalledTimes(1);
  });
  it('keeps the city when the lens fails: it goes, and the view draws straight to the screen', () => {
    const post = fakePost(), f = viewFixture({ post });
    try {
      post.render = () => { throw new Error('no float pictures on this card'); };
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const direct = (f.renderer.render as jest.Mock).mock.calls.length;
      f.frames(2); warn.mockRestore();
      expect((f.renderer.render as jest.Mock).mock.calls.length).toBe(direct + 2);
      expect(post.dispose).toHaveBeenCalledTimes(1); expect(f.view.effects).toEqual({ ao: false, bloom: false, tiltShift: false });
      expect(f.renderer.info.autoReset).toBe(true);
    } finally { f.view.dispose(); }
  });
  it('lights the lens by the hour: a warm, strong glow at night, a faint one by day, colours from the theme', () => {
    const post = fakePost(), f = viewFixture({ post });
    try {
      f.view.setDarkMode(false); f.frames(1); const day = { ...post.looks[post.looks.length - 1].bloom };
      f.view.setDarkMode(true); f.frames(1); const night = post.looks[post.looks.length - 1].bloom;
      expect(night.strength).toBeGreaterThan(day.strength * 4); expect(night.threshold).toBeLessThan(day.threshold);
      expect(night.tint.getHex()).toBe(new (night.tint.constructor as new (hex: number) => typeof night.tint)(SCENE.post.glowNight).getHex());
      const look = post.looks[post.looks.length - 1];
      expect(look.ao.tint.getHex()).toBe(new (look.ao.tint.constructor as new (hex: number) => typeof look.ao.tint)(SCENE.post.contactShadow).getHex());
      expect(look.tilt.strength).toBeGreaterThan(0.3);
    } finally { f.view.dispose(); }
  });
  it('keeps the 2D map sharp: no tilt-shift from straight above', () => {
    const post = fakePost(), f = viewFixture({ post });
    try { f.view.navigation.setFlat(true); f.frames(1); expect(post.looks[post.looks.length - 1].tilt.strength).toBe(0); }
    finally { f.view.dispose(); }
  });
  it('in Auto gives up the glow, then the tilt-shift, before lowering the resolution and then the draw budget', () => {
    const post = fakePost(), f = viewFixture({ post, gpuMs: 30 });
    try {
      f.adapting(); const log: string[] = [];
      let effects = JSON.stringify(f.view.effects), ratio = f.renderer.getPixelRatio(), budget = f.view.chunks.drawBudget;
      for (let i = 0; i < 1400 && log.length < 5; i++) {
        f.frames(1);
        const e = JSON.stringify(f.view.effects); if (e !== effects) { log.push(`effects ${Object.entries(f.view.effects).filter(([, on]) => on).map(([k]) => k).join('+') || 'none'}`); effects = e; }
        if (f.renderer.getPixelRatio() !== ratio) { ratio = f.renderer.getPixelRatio(); log.push(`ratio ${ratio}`); }
        if (f.view.chunks.drawBudget !== budget) { budget = f.view.chunks.drawBudget; log.push(`budget ${budget}`); }
      }
      expect(log).toEqual(['effects tiltShift', 'effects none', 'ratio 1', 'budget 168', 'budget 156']);
      expect(f.view.metrics.effectChanges).toBe(2);
    } finally { f.view.dispose(); }
  });
  it('in Auto takes them back last, once the budget and the resolution are full, up to the contact shadows', () => {
    const post = fakePost(), f = viewFixture({ post, gpuMs: 30 });
    try {
      f.adapting();
      // Slow until the budget has gone down too
      for (let i = 0; i < 1400 && f.view.chunks.drawBudget >= 168; i++) f.frames(1);
      expect(f.view.effects).toEqual({ ao: false, bloom: false, tiltShift: false });
      f.setGpu(3); const log: string[] = [];
      let effects = JSON.stringify(f.view.effects), ratio = f.renderer.getPixelRatio(), budget = f.view.chunks.drawBudget;
      // Frames 40 ms apart, so the minutes of waiting take fewer paints (the card's timer, not the gaps, says there is room)
      for (let i = 0; i < 8000 && !f.view.effects.ao; i++) {
        f.frames(1, 40);
        const e = JSON.stringify(f.view.effects); if (e !== effects) { log.push(`effects ${Object.entries(f.view.effects).filter(([, on]) => on).map(([k]) => k).join('+')}`); effects = e; }
        if (f.renderer.getPixelRatio() !== ratio) { ratio = f.renderer.getPixelRatio(); log.push(`ratio ${ratio}`); }
        if (f.view.chunks.drawBudget !== budget) { budget = f.view.chunks.drawBudget; log.push(`budget ${budget}`); }
      }
      expect(log.slice(-4)).toEqual(['ratio 1.25', 'effects tiltShift', 'effects tiltShift+bloom', 'effects tiltShift+bloom+ao']);
      expect(log.filter(entry => entry.startsWith('budget')).pop()).toBe('budget 180');
      expect(log.indexOf('budget 180')).toBeLessThan(log.indexOf('ratio 1.25'));
    } finally { f.view.dispose(); }
  });
  it('holds a level the player chose, lowering only the resolution and the budget when frames are slow', () => {
    const post = fakePost(), f = viewFixture({ post, gpuMs: 30 });
    try {
      f.view.setQuality('high'); f.adapting();
      for (let i = 0; i < 1400 && f.view.chunks.drawBudget >= 168; i++) f.frames(1);
      expect(f.view.effects).toEqual({ ao: true, bloom: true, tiltShift: true }); expect(f.renderer.getPixelRatio()).toBe(1);
      expect(f.view.metrics.effectChanges).toBe(0);
    } finally { f.view.dispose(); }
  });
});
