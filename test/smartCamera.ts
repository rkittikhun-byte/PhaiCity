/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The smart camera (src/smartCamera.ts), the edge's thin band (src/edgeScroll.ts) and the camera's glide, coast and turn
// round a point (src/render3d/city/camera.ts): owner, 23 Oct 2026.

import { BAND_PX, edgeBand } from "../src/edgeScroll";
import { distanceForWidth, GLIDE_MS, headingAlong, nearPose, PRESETS, presetKind, setSmartCamera, SmartCamera,
  type CameraPose, type GlidingCamera } from "../src/smartCamera";
import { CityCamera } from "../src/render3d/city/camera";

const deg = (d: number): number => d * Math.PI / 180;

/** A camera that records its glides and can be moved by hand */
function fakeCamera(pose: CameraPose): GlidingCamera & { glides: Array<Partial<CameraPose>>; touched: number } {
  const camera = {
    heading: pose.heading, pitch: pose.pitch, distance: pose.distance, target: { x: pose.x, z: pose.z },
    get x() { return camera.target.x; }, get z() { return camera.target.z; },
    minDistance: 5, maxDistance: 10000, flat: false, glides: [] as Array<Partial<CameraPose>>, touched: -Infinity,
    get lastInteractionAt() { return camera.touched; },
    glide(to: Partial<CameraPose>) {
      camera.glides.push(to);
      if (to.pitch !== undefined) camera.pitch = to.pitch;
      if (to.distance !== undefined) camera.distance = to.distance;
      if (to.heading !== undefined) camera.heading = to.heading;
    },
    isAnimating: () => false,
  };
  return camera as never;
}

describe("the smart camera", () => {
  let clock = 0;
  const now = (): number => clock;
  beforeEach(() => { clock = 1000; setSmartCamera(true); });

  test("each kind of tool has its place: brushes, lines, buildings, land; the bulldozer and the inspector none", () => {
    expect(presetKind("zone_residential")).toBe("paint");
    expect(presetKind("zone_farm")).toBe("paint");
    expect(presetKind("zone_erase")).toBe("paint");
    expect(presetKind("road")).toBe("line");
    expect(presetKind("rail")).toBe("line");
    expect(presetKind("canal")).toBe("line");
    expect(presetKind("police")).toBe("build");
    expect(presetKind("land")).toBe("land");
    expect(presetKind("bulldozer")).toBeNull();
    expect(presetKind("query")).toBeNull();
    expect(presetKind(null)).toBeNull();
  });

  test("the distance shows the preset's width of ground across the screen", () => {
    const d = distanceForWidth(100, 16 / 9);
    expect(2 * d * Math.tan(deg(19)) * 16 / 9).toBeCloseTo(100, 6);
  });

  test("a brush turns the view the shorter way so the road runs across the screen", () => {
    // A road running east-west lies across the screen at heading 0
    expect(headingAlong(1, 0, 0.1)).toBeCloseTo(0, 6);
    expect(headingAlong(-1, 0, 0.1)).toBeCloseTo(0, 6);
    // ... one running north-south at a quarter turn, whichever is nearer
    expect(Math.abs(headingAlong(0, 1, 1.4))).toBeCloseTo(Math.PI / 2, 6);
  });

  test("glides to a tool's place, keeps the point at the centre, and does nothing when already there", () => {
    const camera = fakeCamera({ heading: 0, pitch: deg(40), distance: 900, x: 100, z: 200 });
    const smart = new SmartCamera({ navigation: camera, width: 1600, height: 900, unitsPerMetre: () => 0.625 }, () => false, now);
    smart.toolChanged("road");
    expect(camera.glides).toHaveLength(1);
    expect(camera.glides[0].pitch).toBeCloseTo(deg(PRESETS.line.pitchDeg), 6);
    expect(camera.glides[0].distance).toBeCloseTo(distanceForWidth(600 * 0.625, 16 / 9), 6);
    expect(camera.glides[0].x).toBeUndefined();
    // A choice of the same kind (another road level) moves nothing; nor does a second road pick
    smart.toolChanged("road_asphalt");
    smart.toolChanged(null);
    smart.toolChanged("rail");
    // ... and a railway after it, the camera already where railways are drawn, stays (the dead band)
    expect(camera.glides).toHaveLength(1);
    expect(nearPose({ heading: 0, pitch: camera.pitch, distance: camera.distance, x: 0, z: 0 }, camera.glides[0])).toBe(true);
  });

  test("a brush turns to the road; what the player sets by hand is kept for that tool", () => {
    const camera = fakeCamera({ heading: 1, pitch: deg(30), distance: 300, x: 0, z: 0 });
    const smart = new SmartCamera({ navigation: camera, width: 1000, height: 1000, unitsPerMetre: () => 1,
      roadAlong: () => ({ tx: 1, tz: 0 }) }, () => false, now);
    smart.toolChanged("zone_residential");
    expect(camera.glides[0].heading).toBeCloseTo(0, 6);
    expect(camera.glides[0].pitch).toBeCloseTo(deg(65), 6);
    // The player tilts and zooms by hand while painting
    clock += GLIDE_MS + 500; camera.touched = clock; camera.pitch = deg(50); camera.distance = 120;
    smart.toolChanged("police");
    camera.pitch = deg(20); camera.distance = 900;
    smart.toolChanged("zone_commercial");
    const last = camera.glides[camera.glides.length - 1];
    expect(last.pitch).toBeCloseTo(deg(50), 6);
    expect(last.distance).toBeCloseTo(120, 6);
  });

  test("never during a stroke, never when turned off, never on a whole province's map", () => {
    const camera = fakeCamera({ heading: 0, pitch: deg(30), distance: 2000, x: 0, z: 0 });
    let busy = true;
    const smart = new SmartCamera({ navigation: camera, width: 1000, height: 800, unitsPerMetre: () => 1 }, () => busy, now);
    smart.toolChanged("police");
    expect(camera.glides).toHaveLength(0);
    busy = false; setSmartCamera(false);
    smart.toolChanged("road");
    expect(camera.glides).toHaveLength(0);
    setSmartCamera(true);
    const province = new SmartCamera({ navigation: camera, width: 1000, height: 800, unitsPerMetre: () => 0 }, () => false, now);
    province.toolChanged("police");
    expect(camera.glides).toHaveLength(0);
  });

  test("frames a clicked building left of its card, tilted low; a data layer is seen from above", () => {
    const camera = fakeCamera({ heading: 0, pitch: deg(60), distance: 800, x: 0, z: 0 });
    const smart = new SmartCamera({ navigation: camera, width: 1200, height: 800 }, () => false, now);
    smart.frame({ x: 10, y: 20, width: 3, height: 3 });
    const frame = camera.glides[0];
    expect(frame.pitch).toBeCloseTo(deg(35), 6);
    // the point looked at lies to the screen's right of the building (heading 0: east), so the building shows left
    expect(frame.x!).toBeGreaterThan(115);
    expect(frame.z).toBeCloseTo(215, 6);
    smart.layerShown();
    expect(camera.glides[1].pitch).toBeCloseTo(deg(80), 6);
  });
});

describe("the edge's thin band", () => {
  test("only the outermost pixels move the camera, faster at the very edge", () => {
    expect(edgeBand(BAND_PX + 1, 300, 1000, 600, 0.05)).toEqual({ dx: 0, dy: 0 });
    const inner = edgeBand(BAND_PX - 1, 300, 1000, 600, 0.05), edge = edgeBand(0, 300, 1000, 600, 0.05);
    expect(inner.dx).toBeGreaterThan(0);
    expect(edge.dx).toBeGreaterThan(inner.dx);
    expect(edgeBand(999, 300, 1000, 600, 0.05).dx).toBeLessThan(0);
    expect(edgeBand(0, 300, 1000, 600, 0.05, 0.5).dx).toBeCloseTo(edge.dx / 2, 1);
    expect(edgeBand(-1, 300, 1000, 600, 0.05)).toEqual({ dx: 0, dy: 0 });
  });
});

describe("the city camera's glide, coast and turn round a point", () => {
  test("glides there easing in and out, and stops where it is when the player takes it", () => {
    let t = 0;
    const camera = new CityCamera(100, 100, () => t);
    const from = { pitch: camera.pitch, distance: camera.distance };
    camera.glide({ pitch: deg(70), distance: 600 }, 700);
    t = 350; camera.update(t);
    expect(camera.pitch).toBeGreaterThan(from.pitch);
    expect(camera.pitch).toBeLessThan(deg(70));
    t = 700; camera.update(t);
    expect(camera.pitch).toBeCloseTo(deg(70), 6);
    expect(camera.distance).toBeCloseTo(600, 6);
    camera.glide({ distance: 100 }, 700);
    t = 900; camera.update(t);
    camera.pan(1, 0, 500);
    const held = camera.distance;
    t = 1500; camera.update(t);
    expect(camera.distance).toBe(held);
  });

  test("a slide let go coasts on and slows to a stop", () => {
    let t = 0;
    const camera = new CityCamera(100, 100, () => t);
    const x0 = camera.target.x;
    camera.coast(1, 0, 500);
    const xs: number[] = [];
    for (let k = 0; k < 120; k++) { t += 16; camera.update(t); xs.push(camera.target.x); }
    // moving the way a drag to the right moves the point looked at, by less each frame, then not at all
    expect(xs[0]).toBeLessThan(x0);
    expect(Math.abs(xs[1] - xs[0])).toBeGreaterThan(Math.abs(xs[30] - xs[29]));
    expect(xs[119]).toBe(xs[118]);
  });

  test("a right drag turns round the ground under the pointer", () => {
    const camera = new CityCamera(100, 100, () => 0);
    const pivot = { x: camera.target.x + 100, z: camera.target.z };
    const before = Math.hypot(camera.target.x - pivot.x, camera.target.z - pivot.z);
    camera.rotateAbout(50, 0, pivot);
    expect(Math.hypot(camera.target.x - pivot.x, camera.target.z - pivot.z)).toBeCloseTo(before, 6);
    expect(camera.target.x).not.toBeCloseTo(pivot.x - 100, 3);
  });
});
