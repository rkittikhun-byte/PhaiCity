/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The camera's buttons down the right edge (owner, 14 Oct 2026: "ปุ่มบังคับ 3d ... ลูกศร = ฟรี, เลื่อน, หมุน ... ให้ชิดด้าน
// ขวาสวยๆ"): five modes for what a left drag does (free: as always, building and clicking; pan; rotate; zoom; tilt),
// and two that act at once (a view from straight above, north up; the whole city). Taking a mode puts the tool in
// hand down, and picking up a tool goes back to free. Only the view moves: nothing here changes the city.

import { t, onLanguageChange } from "./i18n/index.js";

export const CAMERA_MODES = ["free", "pan", "rotate", "zoom", "tilt"] as const;
export type CameraMode = typeof CAMERA_MODES[number];

let mode: CameraMode = "free";
const listeners: Array<(mode: CameraMode) => void> = [];

/** What a left drag on the city does now */
export const cameraMode = (): CameraMode => mode;

export function setCameraMode(next: CameraMode): void {
  if (next === mode) return;
  mode = next;
  for (const listener of listeners) listener(mode);
}

/** The 3D view's camera, as far as these buttons need it (src/render3d/city/camera.ts) */
interface Navigation {
  heading: number;
  pitch: number;
  update(time: number): void;
  wholeMap?(): void;
  zoom?(delta: number, x: number, y: number, width: number, height: number): void;
}

const ICONS: Record<string, string> = {
  free: "↖", pan: "✥", rotate: "⟳", zoom: "⊕", tilt: "⦣", top: "⊤", whole: "⤢",
};

/** The strip of buttons on the right edge of a city with a 3D view. putDown: put the tool in hand down. */
export function installCameraBar(view: { navigation?: Navigation; width?: number; height?: number }, putDown: () => void,
  doc: Document = document): void {
  const navigation = view.navigation;
  const host = doc.getElementById("canvasContainer")?.parentElement ?? doc.body;
  if (!navigation || doc.getElementById("cameraBar")) return;
  const bar = doc.createElement("div");
  bar.id = "cameraBar";
  bar.setAttribute("role", "toolbar");
  const buttons: Array<[string, HTMLButtonElement]> = [];
  const add = (name: string, act: () => void): void => {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "cameraButton";
    button.dataset.camera = name;
    button.textContent = ICONS[name];
    button.addEventListener("click", act);
    bar.append(button);
    buttons.push([name, button]);
  };
  for (const name of CAMERA_MODES) {
    add(name, () => {
      if (name !== "free") putDown();
      setCameraMode(name);
    });
  }
  const gap = doc.createElement("span");
  gap.className = "cameraGap";
  bar.append(gap);
  add("top", () => {
    navigation.heading = 0;
    navigation.pitch = 85 * Math.PI / 180;
    navigation.update(performance.now());
  });
  add("whole", () => navigation.wholeMap?.());
  const label = (): void => {
    for (const [name, button] of buttons) {
      button.title = t(`camera.${name}`);
      button.setAttribute("aria-label", t(`camera.${name}`));
    }
  };
  const mark = (): void => {
    for (const [name, button] of buttons) button.classList.toggle("selected", name === mode);
  };
  label();
  mark();
  listeners.push(mark);
  onLanguageChange(label);
  // Picking up a tool goes back to free, so the tool builds
  const tools = doc.getElementById("buttons");
  if (tools) {
    new MutationObserver(() => {
      if (tools.querySelector(".toolButton.selected")) setCameraMode("free");
    }).observe(tools, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  host.append(bar);
}
