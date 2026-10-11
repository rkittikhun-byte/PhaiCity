/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The living background of the start screen: a dark bamboo grove swaying in the wind, lit by warm light,
// with motes drifting upwards. This is the temporary 2D version, drawn on a canvas, approved by the owner
// (11 Oct 2026) until Codex delivers the three.js grove (docs/3d/CODEX_PROMPTS.md, Prompt 19), which
// provides the same StartBackdrop interface.

export interface StartBackdrop {
  /** Shifts the light towards a colour (a region's), over a second or two. */
  setTint(color: string): void;
  /** Stops drawing while the start screen is hidden. */
  setPaused(paused: boolean): void;
  dispose(): void;
}

interface Culm {
  x: number;          // base position, 0-1 of the width
  width: number;      // px at a 1000 px tall screen
  segment: number;    // distance between nodes, px at 1000 px
  sway: number;       // amplitude, px at 1000 px
  speed: number;
  phase: number;
  leaves: Array<{ at: number; side: number; length: number; angle: number; flutter: number }>;
}

interface Layer {
  culms: Culm[];
  color: string;
  leafColor: string;
  alpha: number;
}

interface Mote {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

const DEFAULT_TINT: [number, number, number] = [246, 205, 110];
const TINT_SECONDS = 1.6;
const MOTES = 46;

// A small seeded generator, so the grove looks the same on every visit (decoration only, not the simulation)
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function parseColor(color: string): [number, number, number] {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return DEFAULT_TINT;
  const n = parseInt(hex[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function makeLayer(random: () => number, count: number, options: {
  width: [number, number]; sway: number; speed: number; color: string; leafColor: string; alpha: number; edges: boolean;
}): Layer {
  const culms: Culm[] = [];
  for (let i = 0; i < count; i++) {
    // Near layers keep to the edges so the middle of the screen stays clear for the map and text
    let x = (i + random()) / count;
    if (options.edges) x = random() < 0.5 ? random() * 0.2 : 0.82 + random() * 0.2;
    const leaves = [];
    const leafCount = 6 + Math.floor(random() * 8);
    for (let j = 0; j < leafCount; j++) {
      leaves.push({
        at: 0.15 + random() * 0.7,            // height share from the top
        side: random() < 0.5 ? -1 : 1,
        length: 34 + random() * 46,
        angle: 0.25 + random() * 0.6,
        flutter: random() * Math.PI * 2,
      });
    }
    culms.push({
      x,
      width: options.width[0] + random() * (options.width[1] - options.width[0]),
      segment: 70 + random() * 60,
      sway: options.sway * (0.7 + random() * 0.6),
      speed: options.speed * (0.8 + random() * 0.4),
      phase: random() * Math.PI * 2,
      leaves,
    });
  }
  return { culms, color: options.color, leafColor: options.leafColor, alpha: options.alpha };
}

export function mountStartBackdrop(container: HTMLElement): StartBackdrop {
  const canvas = document.createElement("canvas");
  canvas.className = "ppBackdropCanvas";
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);
  const context = canvas.getContext("2d");
  const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const random = seeded(1873);
  const layers: Layer[] = [
    makeLayer(random, 16, { width: [3, 6], sway: 10, speed: 0.35, color: "#3c5a3c", leafColor: "#46684a", alpha: 0.35, edges: false }),
    makeLayer(random, 10, { width: [7, 11], sway: 16, speed: 0.45, color: "#2a4630", leafColor: "#355a3a", alpha: 0.6, edges: false }),
    makeLayer(random, 6, { width: [16, 24], sway: 24, speed: 0.55, color: "#0c1611", leafColor: "#112016", alpha: 0.95, edges: true }),
  ];
  const motes: Mote[] = Array.from({ length: MOTES }, () => ({
    x: random(), y: random(), speed: 0.006 + random() * 0.014, size: 0.6 + random() * 1.8, phase: random() * Math.PI * 2,
  }));

  let tint = [...DEFAULT_TINT] as [number, number, number];
  let tintFrom = tint;
  let tintTo = tint;
  let tintStarted = 0;
  let frame = 0;
  let paused = false;
  let width = 0;
  let height = 0;
  let scale = 1;
  let lastTime = performance.now();

  const resize = (): void => {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = height / 1000;
  };

  const drawCulm = (culm: Culm, layer: Layer, time: number): void => {
    if (!context) return;
    const baseX = culm.x * width;
    const top = -40;
    const bottom = height + 20;
    const bend = (y: number): number => {
      // The higher the point, the further the wind pushes it
      const share = 1 - (y - top) / (bottom - top);
      const gust = Math.sin(time * culm.speed + culm.phase) + 0.35 * Math.sin(time * culm.speed * 2.3 + culm.phase * 1.7);
      return gust * culm.sway * scale * share * share;
    };
    const w = culm.width * scale;

    context.strokeStyle = layer.color;
    context.lineWidth = w;
    context.lineCap = "round";
    context.beginPath();
    for (let y = bottom; y >= top; y -= 24) {
      const x = baseX + bend(y);
      if (y === bottom) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();

    // Nodes: the rings that make bamboo look like bamboo
    context.strokeStyle = "rgba(0, 0, 0, 0.35)";
    context.lineWidth = Math.max(1, w * 0.18);
    const segment = culm.segment * scale;
    for (let y = bottom - segment * 0.6; y > top; y -= segment) {
      const x = baseX + bend(y);
      context.beginPath();
      context.moveTo(x - w * 0.62, y);
      context.lineTo(x + w * 0.62, y);
      context.stroke();
    }

    // Leaves: thin blades that hang from the upper nodes and flutter
    context.fillStyle = layer.leafColor;
    for (const leaf of culm.leaves) {
      const y = top + (bottom - top) * leaf.at * 0.6;
      const x = baseX + bend(y);
      const length = leaf.length * scale * (layer.alpha > 0.9 ? 1.5 : 1);
      const angle = leaf.side * (leaf.angle + 0.12 * Math.sin(time * 1.6 + leaf.flutter)) + Math.PI / 2.4 * leaf.side;
      context.save();
      context.translate(x, y);
      context.rotate(angle);
      context.beginPath();
      context.moveTo(0, 0);
      context.quadraticCurveTo(length * 0.5, -length * 0.09, length, 0);
      context.quadraticCurveTo(length * 0.5, length * 0.09, 0, 0);
      context.fill();
      context.restore();
    }
  };

  const draw = (now: number): void => {
    if (!context) return;
    const time = now / 1000;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    // Ease the light towards its new colour
    const k = Math.min(1, (now - tintStarted) / (TINT_SECONDS * 1000));
    tint = tintFrom.map((c, i) => c + (tintTo[i] - c) * k) as [number, number, number];
    const [r, g, b] = tint.map(Math.round);

    context.clearRect(0, 0, width, height);
    const light = context.createRadialGradient(width * 0.72, height * 0.18, 0, width * 0.72, height * 0.18, Math.max(width, height) * 0.75);
    light.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.22)`);
    light.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.06)`);
    light.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = light;
    context.fillRect(0, 0, width, height);

    for (const layer of layers) {
      context.globalAlpha = layer.alpha;
      for (const culm of layer.culms) drawCulm(culm, layer, time);
    }
    context.globalAlpha = 1;

    // Warm motes drifting up through the light
    for (const mote of motes) {
      if (!reduceMotion) {
        mote.y -= mote.speed * dt;
        if (mote.y < -0.02) {
          mote.y = 1.02;
          mote.x = (mote.x + 0.37) % 1;
        }
      }
      const twinkle = 0.35 + 0.35 * Math.sin(time * 1.3 + mote.phase);
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${twinkle.toFixed(2)})`;
      context.beginPath();
      context.arc(mote.x * width + Math.sin(time * 0.4 + mote.phase) * 12, mote.y * height, mote.size * scale * 1.4, 0, Math.PI * 2);
      context.fill();
    }

    // Mist along the ground
    const mist = context.createLinearGradient(0, height * 0.65, 0, height);
    mist.addColorStop(0, "rgba(5, 9, 8, 0)");
    mist.addColorStop(1, "rgba(5, 9, 8, 0.85)");
    context.fillStyle = mist;
    context.fillRect(0, height * 0.65, width, height * 0.35);

    if (!paused && !reduceMotion) frame = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize);
  frame = requestAnimationFrame(draw);

  return {
    setTint(color) {
      tintFrom = tint;
      tintTo = parseColor(color);
      tintStarted = performance.now();
      if (reduceMotion) requestAnimationFrame(draw);
    },
    setPaused(value) {
      if (paused === value) return;
      paused = value;
      cancelAnimationFrame(frame);
      if (!paused) {
        lastTime = performance.now();
        frame = requestAnimationFrame(draw);
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.remove();
    },
  };
}
