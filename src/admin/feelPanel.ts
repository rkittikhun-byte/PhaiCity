/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The admin page's "ความรู้สึกของเกม" (owner, 23 Oct 2026: "ทำหน้าปรับค่าความรู้สึกของเกมในหน้าหลังบ้านเลย"): every number
// of data/game-feel.json (src/gameFeel.ts) on a card of its group, with what it does in the game, its unit, its range
// and a button back to the game's own value. Saving goes through the dev server (scripts/admin/adminServer.mjs, which
// checks it with checkFeelData), then tells a game open in this browser, which plays with it at once. Thai only, like
// the rest of the page.

import { checkFeelData, DEFAULT_FEEL, FEEL_CHANNEL, FEEL_FIELDS, feelValue, type FeelField, type FeelGroup } from "../gameFeel";

type Json = Record<string, unknown>;

/** What each number is called and does, in the game's words */
const LABELS: Record<string, { name: string; why: string }> = {
  "day.seconds1x": { name: "หนึ่งวันที่ความเร็ว 1x", why: "หนึ่งวันในเกม (เช้าถึงเช้าวันใหม่) ยาวกี่วินาทีจริงที่ความเร็ว 1x" },
  "day.seconds2x": { name: "หนึ่งวันที่ความเร็ว 2x", why: "หนึ่งวันในเกมยาวกี่วินาทีจริงที่ความเร็ว 2x" },
  "day.seconds3x": { name: "หนึ่งวันที่ความเร็ว 3x", why: "หนึ่งวันในเกมยาวกี่วินาทีจริงที่ความเร็ว 3x" },
  "day.nightPace": { name: "กลางคืนผ่านไปเร็วกว่า", why: "กลางคืนเดินเร็วกว่ากลางวันกี่เท่า เมืองจะสว่างให้เห็นนานกว่ามืด" },
  "weather.cloud": { name: "เมฆก่อตัวและจาง", why: "เมื่ออากาศของเดือนเปลี่ยน เมฆรวมตัวหรือสลายเร็วแค่ไหน (น้อยคือช้า)" },
  "weather.rain": { name: "ฝนเริ่มตกและหยุด", why: "ฝนหนักขึ้นหรือซาลงเร็วแค่ไหน (ฝนรอให้เมฆรวมตัวก่อนเสมอ)" },
  "weather.fog": { name: "หมอกลงและจาง", why: "หมอกหนาขึ้นหรือจางลงเร็วแค่ไหน" },
  "weather.smoke": { name: "หมอกควันเผาไร่", why: "ควันสีน้ำตาลจากการเผาไร่และป่าลอยมาหรือจางไปเร็วแค่ไหน" },
  "weather.storm": { name: "พายุ", why: "ฟ้ามืดและฟ้าแลบของพายุมาหรือหายเร็วแค่ไหน" },
  "weather.wetting": { name: "พื้นเปียก", why: "ตอนฝนหนัก พื้น หลังคา และถนนเปียกเร็วแค่ไหน" },
  "weather.drying": { name: "พื้นแห้ง", why: "หลังฝนหยุด พื้นแห้งกลับเร็วแค่ไหน" },
  "camera.paint.pitchDeg": { name: "มุมกล้อง", why: "กล้องเงยจากพื้นกี่องศา (90 คือมองตรงลงมา)" },
  "camera.paint.widthM": { name: "เห็นกว้าง", why: "เห็นพื้นกว้างกี่เมตรจากขอบจอซ้ายถึงขวา และหมุนให้ถนนใกล้สุดวางขวางจอ" },
  "camera.line.pitchDeg": { name: "มุมกล้อง", why: "กล้องเงยจากพื้นกี่องศา (90 คือมองตรงลงมา)" },
  "camera.line.widthM": { name: "เห็นกว้าง", why: "เห็นพื้นกว้างกี่เมตรจากขอบจอซ้ายถึงขวา" },
  "camera.build.pitchDeg": { name: "มุมกล้อง", why: "กล้องเงยจากพื้นกี่องศา (90 คือมองตรงลงมา)" },
  "camera.build.widthM": { name: "เห็นกว้าง", why: "เห็นพื้นกว้างกี่เมตรจากขอบจอซ้ายถึงขวา" },
  "camera.land.pitchDeg": { name: "มุมกล้อง", why: "กล้องเงยจากพื้นกี่องศา (90 คือมองตรงลงมา)" },
  "camera.land.widthM": { name: "เห็นกว้าง", why: "เห็นพื้นกว้างกี่เมตรจากขอบจอซ้ายถึงขวา" },
  "camera.glideSeconds": { name: "เวลาเลื่อนกล้อง", why: "หยิบเครื่องมือแล้วกล้องค่อยๆ เลื่อนไปมุมของเครื่องมือนั้นนานกี่วินาที" },
  "camera.stillPitchDeg": { name: "มุมใกล้พอแล้ว", why: "ถ้ามุมกล้องต่างจากมุมที่ต้องการไม่เกินเท่านี้ กล้องอยู่นิ่ง ไม่กระตุก" },
  "camera.stillDistanceShare": { name: "ระยะใกล้พอแล้ว", why: "ถ้าระยะกล้องต่างไม่เกินส่วนนี้ (0.2 คือราว 20%) กล้องอยู่นิ่ง" },
  "camera.stillHeadingDeg": { name: "ทิศใกล้พอแล้ว", why: "ถ้าทิศที่กล้องหันต่างไม่เกินเท่านี้ กล้องไม่หมุน" },
  "edge.bandPx": { name: "แถบขอบจอ", why: "ตอนไม่ได้วาดเส้น เมาส์ต้องชิดขอบจอแค่ไหนกล้องจึงเลื่อน (0 คือไม่เลื่อนเลย)" },
  "edge.bandDwellMs": { name: "ต้องพักเมาส์ก่อน", why: "เมาส์ต้องค้างในแถบขอบนานเท่านี้ก่อนกล้องเลื่อน กันกล้องเลื่อนตอนแค่ผ่านไปกดการ์ด" },
  "edge.bandSpeed": { name: "ความเร็วแถบขอบ", why: "กล้องเลื่อนเร็วสุดเท่าไรเมื่อเมาส์ชิดขอบจอ (เทียบกับการลากเมาส์)" },
  "edge.bandBuildingShare": { name: "ถืออาคารอยู่ เลื่อนช้าลงเหลือ", why: "ส่วนของความเร็วเมื่อถือเครื่องมือวางอาคาร (0.5 คือครึ่งเดียว)" },
  "edge.edgePx": { name: "ขอบตอนวาดเส้น", why: "ตอนวาดถนน ราง คลอง หรือระบายโซน เมาส์เข้าใกล้ขอบจอเท่านี้กล้องก็เริ่มเลื่อนตาม" },
  "edge.edgeSpeed": { name: "ความเร็วตอนวาดเส้น", why: "กล้องเลื่อนเร็วสุดเท่าไรเมื่อเมาส์ชิดขอบขณะวาด (เทียบกับการลากเมาส์)" },
};

const UNITS: Record<string, string> = {
  s: "วินาที", x: "เท่า", "/s": "ต่อวินาที", deg: "องศา", m: "เมตร", px: "พิกเซล", ms: "มิลลิวินาที",
  "px/s": "พิกเซล/วินาที", share: "ส่วน (0–1)",
};

const GROUPS: Record<FeelGroup, { title: string; hint: string }> = {
  day: { title: "ความยาวของวัน", hint: "นาฬิกาในแถบเวลาและแสงเช้า-ค่ำ ปฏิทินและระบบจำลองเมืองเดินของมันเองไม่เกี่ยวกัน ผู้เล่นเลือกวันสั้น (ครึ่งหนึ่ง) หรือยาว (สองเท่า) ของค่านี้ได้ในหน้าตั้งค่า" },
  weather: { title: "อากาศเปลี่ยนช้าเร็ว", hint: "ระบบจำลองเลือกอากาศของเดือน ส่วนนี้คือภาพ 3 มิติค่อยๆ เปลี่ยนตามเร็วแค่ไหน ตัวเลขเป็นส่วนต่อวินาที 0.1 คือเปลี่ยนเกือบหมดในราว 30 วินาที" },
  camera: { title: "กล้องอัจฉริยะ", hint: "หยิบเครื่องมือแล้วกล้องเลื่อนไปมุมที่ใช้งานง่าย ถ้าผู้เล่นปรับกล้องเองขณะถือเครื่องมือ เกมจำมุมของผู้เล่นไว้แทนค่านี้" },
  edge: { title: "กล้องเลื่อนที่ขอบจอ", hint: "หน่วยพิกเซลคือระยะบนจอ ความเร็วเทียบกับการลากเมาส์ไปเท่านั้นพิกเซลในหนึ่งวินาที" },
};

const TOOL_KINDS: Record<string, string> = {
  paint: "ระบายโซน (บ้าน ร้านค้า โรงงาน เกษตร)", line: "ลากเส้น (ถนน ราง คลอง)", build: "วางอาคาร", land: "ซื้อที่ดิน",
};

/** A plain reading of a number in game terms, beside it ("8 นาที", "เกือบหมดใน ~20 วินาที") */
function reading(f: FeelField, value: number): string {
  const time = (seconds: number): string => seconds >= 90 ? `${Math.round(seconds / 6) / 10} นาที` : `${Math.round(seconds)} วินาที`;
  if (f.group === "day" && f.unit === "s") return `= ${time(value)}`;
  if (f.path === "weather.wetting") return value > 0 ? `ฝนหนัก: เปียกเต็มในราว ${time(1 / value)}` : "";
  if (f.path === "weather.drying") return value > 0 ? `แห้งสนิทในราว ${time(1 / value)}` : "";
  if (f.group === "weather") return value > 0 ? `เปลี่ยนเกือบหมดในราว ${time(3 / value)}` : "";
  return "";
}

let raw: Json = {};
let host: HTMLElement | null = null;
let onChange: () => void = () => undefined;

const $el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function setRaw(path: string, value: number | undefined): void {
  const keys = path.split(".");
  let at = raw;
  for (const key of keys.slice(0, -1)) {
    if (!at[key] || typeof at[key] !== "object") at[key] = {};
    at = at[key] as Json;
  }
  if (value === undefined) delete at[keys[keys.length - 1]];
  else at[keys[keys.length - 1]] = value;
}

function row(f: FeelField): HTMLElement {
  const label = LABELS[f.path] ?? { name: f.path, why: "" };
  const fallback = feelValue(DEFAULT_FEEL, f.path) as number;
  const own = feelValue(raw, f.path);
  const box = $el("div", "feelRow");
  box.dataset.path = f.path;
  const input = $el("input");
  input.type = "number";
  input.min = String(f.min);
  input.max = String(f.max);
  input.step = String(f.step);
  input.value = typeof own === "number" ? String(own) : String(fallback);
  const reads = $el("div", "reads");
  const reset = $el("button", "reset", `ค่าเดิม ${fallback}`);
  reset.title = "กลับเป็นค่าที่เกมมีมาเอง";
  const show = (): void => {
    const value = Number(input.value);
    const wrong = input.value === "" || !Number.isFinite(value) || value < f.min || value > f.max;
    input.classList.toggle("wrong", wrong);
    input.classList.toggle("changed", !wrong && value !== fallback);
    reset.disabled = !wrong && value === fallback;
    reads.textContent = wrong ? `ต้องอยู่ระหว่าง ${f.min} ถึง ${f.max}` : reading(f, value);
  };
  input.addEventListener("input", () => {
    const value = Number(input.value);
    // A wrong number is kept as typed, so the check on saving names it
    setRaw(f.path, input.value === "" ? undefined : Number.isFinite(value) ? value : undefined);
    show();
    onChange();
  });
  reset.addEventListener("click", () => {
    input.value = String(fallback);
    setRaw(f.path, fallback);
    show();
    onChange();
  });
  const value = $el("div", "value");
  value.append(input, $el("span", "unit", `${UNITS[f.unit] ?? f.unit} (${f.min}–${f.max})`), reset);
  box.append($el("div", "name", label.name), value, $el("div", "why", label.why), reads);
  show();
  return box;
}

function render(): void {
  if (!host) return;
  const cards = $el("div", "feelCards");
  for (const group of Object.keys(GROUPS) as FeelGroup[]) {
    const card = $el("section", "feelCard");
    card.append($el("h3", undefined, GROUPS[group].title), $el("p", "hint", GROUPS[group].hint));
    let kind = "";
    for (const f of FEEL_FIELDS.filter((x) => x.group === group)) {
      const sub = f.path.split(".").length === 3 ? f.path.split(".")[1] : "";
      if (sub !== kind) {
        kind = sub;
        if (sub) card.appendChild($el("h4", undefined, `เครื่องมือ${TOOL_KINDS[sub] ?? sub}`));
        else card.appendChild($el("h4", undefined, "การเลื่อน"));
      }
      card.appendChild(row(f));
    }
    cards.appendChild(card);
  }
  host.replaceChildren(
    $el("h2", undefined, "ความรู้สึกของเกม"),
    $el("p", "sub", "ตัวเลขที่ทำให้เกมรู้สึกช้าหรือเร็ว ใกล้หรือไกล ไม่เปลี่ยนเมืองหรือระบบจำลอง เก็บใน data/game-feel.json"),
    $el("p", "hint", "กดบันทึกแล้ว เกมที่เปิดอยู่ในเบราว์เซอร์นี้ (dev server เดียวกัน) ใช้ค่าใหม่ทันทีไม่ต้องโหลดใหม่ เบราว์เซอร์อื่นต้องโหลดหน้าเกมใหม่"),
    cards,
  );
}

/** Shows the feel file (null: there is none yet, so the game's own) in host; changed is called on every edit */
export function showFeel(where: HTMLElement, file: Json | null, changed: () => void): void {
  host = where;
  raw = file ?? JSON.parse(JSON.stringify(DEFAULT_FEEL)) as Json;
  onChange = changed;
  render();
}

/** The feel as edited, and what is wrong with it */
export function editedFeel(): { feel: Json; problems: string[] } {
  return { feel: raw, problems: checkFeelData(raw).problems };
}

/** Saves the feel through the dev server and tells a game open in this browser; throws with the problems */
export async function saveFeel(): Promise<string[]> {
  const { feel, problems } = editedFeel();
  if (problems.length) throw new Error(problems.join("\n"));
  const response = await fetch("__admin/feel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feel }),
  });
  const result = await response.json() as { saved?: string[]; problems?: string[]; feel?: Json };
  if (!response.ok) throw new Error((result.problems ?? [`HTTP ${response.status}`]).join("\n"));
  try {
    const channel = new BroadcastChannel(FEEL_CHANNEL);
    channel.postMessage(result.feel ?? feel);
    channel.close();
  } catch {
    // Without the channel the game takes the new feel when it is next opened
  }
  return result.saved ?? [];
}
