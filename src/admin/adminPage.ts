/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The owner's admin page (admin.html, docs/PROVINCE_PROFILE.md), on the dev server only: every province's profile
// (its measurements, resources and rules) to see, and its resources and its own and its region's rules to set.
// It edits the two data files as they are, comments and all, and saves them through the dev server's endpoint
// (scripts/admin/adminServer.mjs), which checks them with the game's own checks. An owner's tool in Thai, like the
// map review page (geo-review.html); the resources' names, gains and costs come from the game's strings. Its second view
// is how the game feels (data/game-feel.json, src/admin/feelPanel.ts).

import { t } from "../i18n/index";
import {
  checkRulesData, DEFAULT_RULES, resolveRules, ruleEffects, TOOL_COSTS, ZONES, type RulesData,
} from "../provinceRules";
import {
  checkProfilesData, type Indicators, type Levels, MADE_UP, MAX_LEVEL, measuredLevels, provinceLevels,
  type ProfileEntry, type ResourceId,
} from "../geo/provinceResources";
import { saveFeel, showFeel } from "./feelPanel";

interface Region { id: string; nameTh: string; nameEn: string }
interface Province { id: string; nameTh: string; nameEn: string; region: string }

type Json = Record<string, unknown>;

// The two files as they are on disk, edited in place
let rulesRaw: Json & { regions: Record<string, Json>; provinces: Record<string, Json> };
let profilesRaw: Json & { provinces: Record<string, Json> };
let regions: Region[] = [];
let provinces: Province[] = [];
let indicators: Record<string, Indicators> = {};
let measured: Record<string, Levels> = {};
let selected: string | null = null;
let layer: "province" | "region" = "province";
let dirty = false;
/** The feel changed and not saved yet */
let feelDirty = false;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const resourceKey = (id: ResourceId): string => id.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const dots = (level: number): string => "●".repeat(level) + "○".repeat(MAX_LEVEL - level);
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ZONE_NAMES: Record<string, string> = { residential: "บ้าน", commercial: "ร้านค้า", industrial: "โรงงาน" };

function setStatus(text: string, kind: "" | "dirty" | "error" = ""): void {
  const status = $("status");
  status.textContent = text;
  status.className = `status ${kind}`;
}

function markDirty(): void {
  dirty = true;
  markUnsaved();
  renderList();
}

function markUnsaved(): void {
  ($("save") as HTMLButtonElement).disabled = false;
  setStatus("ยังไม่ได้บันทึก", "dirty");
}

/** The provinces' view or the game's feel */
function showView(feel: boolean): void {
  $("provinces").hidden = feel;
  $("feel").hidden = !feel;
  $("showProvinces").classList.toggle("selected", !feel);
  $("showFeel").classList.toggle("selected", feel);
  try {
    window.location.hash = feel ? "feel" : selected ?? "";
  } catch {
    // The hash only brings the owner back to the same view
  }
}

function checkedRules(): RulesData {
  return checkRulesData(rulesRaw).data;
}

/** The raw patch of the layer being edited, made when first written to. */
function layerPatch(create: boolean): Json | null {
  if (!selected) return null;
  const province = provinces.find((p) => p.id === selected)!;
  const table = layer === "province" ? rulesRaw.provinces : rulesRaw.regions;
  const id = layer === "province" ? province.id : province.region;
  if (!table[id] && create) table[id] = {};
  return (table[id] as Json) ?? null;
}

/** Drops empty objects left behind, so the file keeps only what a layer changes. */
function tidyPatch(): void {
  const patch = layerPatch(false);
  if (!patch) return;
  for (const key of ["demand", "cost"]) {
    if (patch[key] && Object.keys(patch[key] as Json).length === 0) delete patch[key];
  }
  const province = provinces.find((p) => p.id === selected)!;
  const table = layer === "province" ? rulesRaw.provinces : rulesRaw.regions;
  const id = layer === "province" ? province.id : province.region;
  if (Object.keys(patch).filter((key) => !key.startsWith("_")).length === 0 && layer === "province") delete table[id];
}

function profileEntry(id: string, create: boolean): Json | null {
  if (!profilesRaw.provinces[id] && create) profilesRaw.provinces[id] = {};
  return (profilesRaw.provinces[id] as Json) ?? null;
}

function hasOwnSettings(id: string): boolean {
  const entry = profilesRaw.provinces[id] as ProfileEntry | undefined;
  return Boolean((entry?.levels && Object.keys(entry.levels).length) || entry?.note || rulesRaw.provinces[id]);
}

// ---------------------------------------------------------------- the list

function renderList(): void {
  const query = ($("search") as HTMLInputElement).value.trim().toLowerCase();
  const region = ($("regionFilter") as HTMLSelectElement).value;
  const list = $("provinceList");
  list.replaceChildren();
  for (const province of provinces) {
    if (region && province.region !== region) continue;
    if (query && !`${province.nameTh} ${province.nameEn} ${province.id}`.toLowerCase().includes(query)) continue;
    const item = element("li");
    const button = element("button", province.id === selected ? "selected" : "");
    button.append(element("span", undefined, province.nameTh));
    if (hasOwnSettings(province.id)) button.append(element("span", "mark", "★"));
    button.append(element("span", "id", province.id));
    button.addEventListener("click", () => select(province.id));
    item.appendChild(button);
    list.appendChild(item);
  }
}

function select(id: string): void {
  selected = id;
  renderList();
  renderDetail();
  try {
    window.location.hash = id;
  } catch {
    // The hash only brings the owner back to the same province
  }
}

// ---------------------------------------------------------------- the province

function fact(label: string, value: string): HTMLElement {
  const box = element("div");
  box.append(element("b", undefined, label), document.createTextNode(value));
  return box;
}

const pct = (share: number | undefined): string => `${Math.round((share ?? 0) * 1000) / 10}%`;
const num = (value: number | undefined): string => (value ?? 0).toLocaleString("th-TH");

function renderFacts(province: Province): HTMLElement {
  const i = indicators[province.id] ?? {};
  const facts = element("div", "facts");
  facts.append(
    fact("พื้นที่", `${num(i.areaKm2)} ตร.กม.`),
    fact("ที่ราบ / ป่า / น้ำ (แผนที่เกม)", `${pct(i.land)} / ${pct(i.woods)} / ${pct(i.water)}`),
    fact("ความสูง", `${num(i.heightMin)}–${num(i.heightMax)} ม.`),
    fact("ชายฝั่ง", `${num(i.coastKm)} กม.`),
    fact("อุทยานและป่าสงวน", pct(i.protectedShare)),
    fact("พื้นที่เมือง (OSM)", pct(i.urbanShare)),
    fact("ที่พักและที่เที่ยว", num(i.tourism)),
    fact("ชายหาด", num(i.beaches)),
    fact("ด่านชายแดน", num(i.borderCrossings)),
    fact("บ่อหินและเหมือง", num(i.quarries)),
    fact("อ่างเก็บน้ำใหญ่", num(i.reservoirs)),
    fact("โรงไฟฟ้า แดด/น้ำ/ก๊าซ/ถ่านหิน/ชีวมวล",
      `${num(i.solarPlants)} / ${num(i.hydroPlants)} / ${num(i.gasPlants)} / ${num(i.coalPlants)} / ${num(i.biomassPlants)}`),
    fact("นิคมและโรงงาน (OSM)", pct(i.industryShare)),
    fact("บ่อเลี้ยงสัตว์น้ำ", pct(i.aquacultureShare)),
  );
  return facts;
}

function renderResources(province: Province): HTMLElement {
  const entry = profilesRaw.provinces[province.id] as ProfileEntry | undefined;
  const table = element("table");
  const head = element("tr");
  for (const label of ["ทรัพยากร", "วัดได้", "อนุมาน", "ตั้งเอง", "ใช้จริง", "ได้ / เสีย"]) head.appendChild(element("th", undefined, label));
  table.appendChild(head);
  const levels = provinceLevels(measured[province.id], checkProfilesData(profilesRaw).data.provinces[province.id]);
  for (const resource of levels) {
    const key = resourceKey(resource.id);
    const row = element("tr");
    const name = element("td", undefined, t(`resource.level.${key}`));
    if (MADE_UP.includes(resource.id)) name.append(element("div", "hint", t("resource.made_up")));
    row.appendChild(name);
    const measuredLevel = measured[province.id]?.[resource.id];
    row.appendChild(element("td", "num", measuredLevel === undefined ? "—" : String(measuredLevel)));
    const inferred = entry?.inferred?.[resource.id];
    row.appendChild(element("td", "num", inferred === undefined ? "—" : String(inferred)));
    const own = element("td", "num");
    const choose = element("select", "level");
    choose.appendChild(new Option("—", ""));
    for (let level = 0; level <= MAX_LEVEL; level++) choose.appendChild(new Option(String(level), String(level)));
    const ownLevel = entry?.levels?.[resource.id];
    choose.value = ownLevel === undefined ? "" : String(ownLevel);
    choose.addEventListener("change", () => {
      const raw = profileEntry(province.id, true)!;
      const ownLevels = (raw.levels as Json | undefined) ?? {};
      if (choose.value === "") delete ownLevels[resource.id];
      else ownLevels[resource.id] = Number(choose.value);
      if (Object.keys(ownLevels).length) raw.levels = ownLevels;
      else delete raw.levels;
      if (Object.keys(raw).length === 0) delete profilesRaw.provinces[province.id];
      markDirty();
      renderDetail();
    });
    own.appendChild(choose);
    row.appendChild(own);
    row.appendChild(element("td", "dots", dots(resource.level)));
    const tradeoff = element("td", "tradeoff");
    tradeoff.append(element("div", "gain", `+ ${t(`resource.gain.${key}`)}`), element("div", "cost", `− ${t(`resource.cost.${key}`)}`));
    row.appendChild(tradeoff);
    table.appendChild(row);
  }
  return table;
}

function renderNote(province: Province): HTMLElement {
  const note = element("textarea");
  note.placeholder = "บันทึกของเจ้าของเกี่ยวกับจังหวัดนี้";
  note.value = (profilesRaw.provinces[province.id] as ProfileEntry | undefined)?.note ?? "";
  note.addEventListener("input", () => {
    const raw = profileEntry(province.id, true)!;
    if (note.value.trim()) raw.note = note.value;
    else delete raw.note;
    if (Object.keys(raw).length === 0) delete profilesRaw.provinces[province.id];
    markDirty();
  });
  return note;
}

/** A number field of the layer's patch: empty takes the value from the layer below, shown greyed. */
function numberField(label: string, inherited: number, get: () => unknown, set: (value: number | undefined) => void,
    step = 0.1): HTMLElement {
  const box = element("label", undefined, label);
  const input = element("input");
  input.type = "number";
  input.step = String(step);
  input.placeholder = String(inherited);
  const value = get();
  input.value = typeof value === "number" ? String(value) : "";
  input.classList.toggle("own", input.value !== "");
  input.addEventListener("change", () => {
    set(input.value === "" ? undefined : Number(input.value));
    tidyPatch();
    markDirty();
    renderDetail();
  });
  box.appendChild(input);
  return box;
}

function renderRules(province: Province): HTMLElement {
  const box = element("div");
  const region = regions.find((r) => r.id === province.region);
  const tabs = element("div", "tabs");
  for (const [id, label] of [["province", `จังหวัด${province.nameTh}`], ["region", region?.nameTh ?? province.region]] as const) {
    const tab = element("button", layer === id ? "selected" : "", label);
    tab.addEventListener("click", () => {
      layer = id;
      renderDetail();
    });
    tabs.appendChild(tab);
  }
  box.appendChild(tabs);
  box.appendChild(element("p", "hint", layer === "province"
    ? "ค่าของจังหวัดนี้ทับค่าของภาค ช่องว่างคือใช้ค่าของภาค (ตัวเลขจาง)"
    : "ค่าของภาคใช้กับทุกจังหวัดในภาค ช่องว่างคือใช้ค่าของเกม (ตัวเลขจาง)"));

  const data = checkedRules();
  // What the layer below gives: the region's rules for a province, the game's own for a region
  const below = layer === "province" ? resolveRules(data, province.region, null) : DEFAULT_RULES;
  const patch = () => layerPatch(false) ?? {};
  const sub = (key: "demand" | "cost") => (patch()[key] as Json | undefined) ?? {};
  const setSub = (key: "demand" | "cost", name: string, value: number | undefined) => {
    const raw = layerPatch(true)!;
    const table = (raw[key] as Json | undefined) ?? {};
    if (value === undefined) delete table[name];
    else table[name] = value;
    raw[key] = table;
  };
  const setTop = (key: string, value: number | undefined) => {
    const raw = layerPatch(true)!;
    if (value === undefined) delete raw[key];
    else raw[key] = value;
  };

  box.appendChild(element("h4", undefined, "ความต้องการเขต (คูณ)"));
  const demand = element("div", "fields");
  for (const zone of ZONES) {
    demand.appendChild(numberField(ZONE_NAMES[zone], below.demand[zone], () => sub("demand")[zone],
      (v) => setSub("demand", zone, v)));
  }
  box.appendChild(demand);

  box.appendChild(element("h4", undefined, "ผลผลิตและค่าใช้จ่าย"));
  const other = element("div", "fields");
  other.append(
    numberField("ไฟจากโรงไฟฟ้า (คูณ)", below.powerPlantOutput, () => patch().powerPlantOutput, (v) => setTop("powerPlantOutput", v)),
    numberField("ควันจากโรงงาน (คูณ)", below.industryPollution, () => patch().industryPollution, (v) => setTop("industryPollution", v)),
    numberField("ค่าถางป่าต่อช่อง (บาท)", below.clearWoodsCost, () => patch().clearWoodsCost, (v) => setTop("clearWoodsCost", v), 1),
  );
  box.appendChild(other);

  box.appendChild(element("h4", undefined, "หน้าแล้ง"));
  const own = patch().drought as { months?: number[]; share?: number } | undefined;
  const drought = element("div");
  const toggle = element("label");
  const ownBox = element("input");
  ownBox.type = "checkbox";
  ownBox.checked = own !== undefined;
  toggle.append(ownBox, document.createTextNode(layer === "province" ? " กำหนดหน้าแล้งของจังหวัดเอง" : " กำหนดหน้าแล้งของภาค"));
  ownBox.addEventListener("change", () => {
    const raw = layerPatch(true)!;
    if (ownBox.checked) raw.drought = { months: [...below.drought.months], share: below.drought.share || 0.3 };
    else delete raw.drought;
    tidyPatch();
    markDirty();
    renderDetail();
  });
  drought.appendChild(toggle);
  const shown = own ?? below.drought;
  const months = element("div", "months");
  MONTHS.forEach((name, index) => {
    const label = element("label");
    const tick = element("input");
    tick.type = "checkbox";
    tick.disabled = own === undefined;
    tick.checked = (shown.months ?? []).includes(index + 1);
    tick.addEventListener("change", () => {
      const raw = (layerPatch(true)!.drought as { months: number[]; share: number });
      const set = new Set(raw.months);
      if (tick.checked) set.add(index + 1);
      else set.delete(index + 1);
      raw.months = [...set].sort((a, b) => a - b);
      markDirty();
      renderDetail();
    });
    label.append(tick, document.createTextNode(name));
    months.appendChild(label);
  });
  drought.appendChild(months);
  const shareFields = element("div", "fields");
  const share = numberField("โรงผลิตน้ำจ่ายน้อยลง (0–0.9)", below.drought.share, () => own?.share, (v) => {
    const raw = layerPatch(true)!.drought as { months: number[]; share: number } | undefined;
    if (raw) raw.share = v ?? 0;
  }, 0.05);
  (share.querySelector("input") as HTMLInputElement).disabled = own === undefined;
  shareFields.appendChild(share);
  drought.appendChild(shareFields);
  box.appendChild(drought);

  box.appendChild(element("h4", undefined, "ราคาเครื่องมือ (คูณ)"));
  const costs = element("div", "fields");
  for (const tool of TOOL_COSTS) {
    costs.appendChild(numberField(t(`tool.${tool}`, { price: "" }).trim(), below.cost[tool], () => sub("cost")[tool],
      (v) => setSub("cost", tool, v)));
  }
  box.appendChild(costs);

  const seasons = resolveRules(data, province.region, layer === "province" ? province.id : null).seasons;
  box.appendChild(element("h4", undefined, "ภัยตามฤดู"));
  box.appendChild(element("p", "hint", seasons.length
    ? seasons.map((s) => `${s.disaster}: ${s.months.map((m) => MONTHS[m - 1]).join(" ")} เดือนละ ${Math.round(s.chancePerMonth * 100)}%`).join(" · ")
    : "ไม่มี"));
  box.appendChild(element("p", "hint", "แก้ภัยตามฤดูได้ใน data/province-rules.json (หน้านี้ยังแก้ไม่ได้)"));
  return box;
}

function renderEffects(province: Province): HTMLElement {
  const list = element("ul", "effects");
  const effects = ruleEffects(resolveRules(checkedRules(), province.region, province.id),
    (month) => t(`month.${month}`));
  for (const effect of effects) list.appendChild(element("li", effect.good ? "good" : "bad", t(effect.key, effect.params)));
  if (effects.length === 0) list.appendChild(element("li", undefined, "เล่นตามค่าของเกม"));
  return list;
}

function renderDetail(): void {
  const detail = $("detail");
  const province = provinces.find((p) => p.id === selected);
  if (!province) return;
  const region = regions.find((r) => r.id === province.region);
  const scroll = window.scrollY;
  detail.replaceChildren(
    element("h2", undefined, province.nameTh),
    element("p", "sub", `${province.nameEn} · ${province.id} · ${region?.nameTh ?? province.region}`),
    element("h3", undefined, "ข้อมูลที่วัดได้ (OpenStreetMap และแผนที่เกม)"),
    renderFacts(province),
    element("h3", undefined, "ทรัพยากร (ระดับ 0–5)"),
    element("p", "hint", "วัดได้: จัดอันดับจากข้อมูลจริงทั้ง 77 จังหวัด · อนุมาน: เกมเดาจากข้อมูลทั่วไป · ตั้งเอง: ค่าของคุณ ทับทุกอย่าง (— คือไม่ตั้ง)"),
    renderResources(province),
    element("h3", undefined, "หมายเหตุ"),
    renderNote(province),
    element("h3", undefined, "สิ่งที่ผู้เล่นเห็นบนการ์ดจังหวัด"),
    renderEffects(province),
    element("h3", undefined, "กติกา"),
    renderRules(province),
  );
  window.scrollTo(0, scroll);
}

// ---------------------------------------------------------------- saving

async function save(): Promise<void> {
  ($("save") as HTMLButtonElement).disabled = true;
  setStatus("กำลังบันทึก…");
  try {
    const saved: string[] = [];
    if (dirty) {
      const response = await fetch("__admin/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesRaw, profiles: profilesRaw }),
      });
      const result = await response.json() as { saved?: string[]; problems?: string[] };
      if (!response.ok) throw new Error((result.problems ?? [`HTTP ${response.status}`]).join("\n"));
      dirty = false;
      saved.push(...(result.saved ?? []));
    }
    if (feelDirty) {
      saved.push(...await saveFeel());
      feelDirty = false;
    }
    setStatus(`บันทึกแล้ว: ${saved.join(", ")}`);
  } catch (error) {
    ($("save") as HTMLButtonElement).disabled = false;
    setStatus(`บันทึกไม่ได้: ${(error as Error).message}`, "error");
  }
}

async function load(): Promise<void> {
  const fetchJson = async <T>(url: string): Promise<T> => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    return await response.json() as T;
  };
  const [files, list, measuredFile] = await Promise.all([
    fetchJson<{ rules: typeof rulesRaw; profiles: typeof profilesRaw; feel: Json | null }>("__admin/data"),
    fetchJson<{ regions: Region[]; provinces: Province[] }>("data/thailand-provinces.json"),
    fetchJson<{ provinces: Record<string, Indicators> }>("data/geo/province-indicators.json"),
  ]);
  rulesRaw = files.rules;
  rulesRaw.regions ??= {};
  rulesRaw.provinces ??= {};
  profilesRaw = files.profiles;
  profilesRaw.provinces ??= {};
  regions = list.regions;
  provinces = list.provinces;
  indicators = measuredFile.provinces;
  measured = measuredLevels(indicators);

  const filter = $("regionFilter") as HTMLSelectElement;
  for (const region of regions) filter.appendChild(new Option(region.nameTh, region.id));
  filter.addEventListener("change", renderList);
  $("search").addEventListener("input", renderList);
  $("save").addEventListener("click", () => void save());
  window.addEventListener("beforeunload", (event) => {
    if (dirty || feelDirty) event.preventDefault();
  });
  showFeel($("feel"), files.feel, () => {
    feelDirty = true;
    markUnsaved();
  });
  $("showProvinces").addEventListener("click", () => showView(false));
  $("showFeel").addEventListener("click", () => showView(true));
  setStatus("พร้อม");
  renderList();
  const fromHash = window.location.hash.slice(1);
  select(provinces.some((p) => p.id === fromHash) ? fromHash : provinces[0].id);
  if (fromHash === "feel") showView(true);
}

load().catch((error: Error) => setStatus(`โหลดไม่ได้: ${error.message} (เปิดผ่าน npm run dev เท่านั้น)`, "error"));
