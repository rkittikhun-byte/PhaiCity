/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Owner-facing review page for the preset province maps (docs/geo/CODEX_PROMPTS.md, G2).
// It reads the committed data files at runtime and draws each map at a few pixels per tile.

import { decodePresetCells, PresetFlag, PresetMap } from "../geo/presetMap";

interface Province {
  id: string;
  nameTh: string;
  nameEn: string;
  region: string;
}

interface Region {
  id: string;
  nameTh: string;
}

interface CenterInfo {
  source: string;
}

const CARD_PIXELS_PER_TILE = 2;
const DETAIL_PIXELS_PER_TILE = 5;
const COLORS = ["#c8794a", "#3f7fb8", "#3f8a46"];

const FLAG_TEXT: Record<PresetFlag, string> = {
  too_much_water: "น้ำเยอะเกินไป (ที่ดินน้อยกว่า 40%)",
  no_water: "ไม่มีน้ำเลย ทั้งที่จังหวัดมีแม่น้ำหรือทะเล จุดกลางอาจไม่ตรง",
  coast_not_on_edge: "จังหวัดติดทะเล แต่ทะเลไม่อยู่ในแผนที่นี้",
  center_missing: "หาจุดกลางเมืองไม่ได้",
};

const SOURCE_TEXT: Record<string, string> = {
  admin_centre: "admin_centre (OSM)",
  osm_named_area: "พื้นที่ที่มีชื่อ (OSM)",
  capital_4: "capital=4 (OSM)",
  name_match: "ชื่อตรงกัน (OSM)",
  override: "แก้เอง (override)",
};

async function loadJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    return response.ok ? await response.json() as T : null;
  } catch {
    return null;
  }
}

function drawMap(canvas: HTMLCanvasElement, map: PresetMap, pixelsPerTile: number): void {
  const cells = decodePresetCells(map);
  canvas.width = map.width * pixelsPerTile;
  canvas.height = map.height * pixelsPerTile;
  const context = canvas.getContext("2d");
  if (!context) return;

  for (let row = 0; row < map.height; row++) {
    for (let column = 0; column < map.width; column++) {
      context.fillStyle = COLORS[cells[row * map.width + column]] ?? "#000";
      context.fillRect(column * pixelsPerTile, row * pixelsPerTile, pixelsPerTile, pixelsPerTile);
    }
  }

  // The map center sits in the middle of the grid by construction.
  const radius = Math.max(3, pixelsPerTile * 1.5);
  context.strokeStyle = "#ffffff";
  context.lineWidth = Math.max(1.5, pixelsPerTile / 2);
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
  context.stroke();
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function describeMap(map: PresetMap, center: CenterInfo | undefined): string {
  const source = center ? SOURCE_TEXT[center.source] ?? center.source : "ไม่ทราบ";
  return `ที่ดิน ${percent(map.stats.land)} · น้ำ ${percent(map.stats.water)} · ป่า ${percent(map.stats.woods)}` +
    ` · จุดกลาง: ${source}`;
}

function openDetail(province: Province, map: PresetMap, center: CenterInfo | undefined): void {
  const dialog = document.getElementById("detail") as HTMLDialogElement;
  const { lat, lon } = map.center;
  (document.getElementById("detailTitle") as HTMLElement).textContent =
    `${province.nameTh} (${province.nameEn}) · ${province.id}`;
  drawMap(document.getElementById("detailCanvas") as HTMLCanvasElement, map, DETAIL_PIXELS_PER_TILE);
  (document.getElementById("detailMeta") as HTMLElement).textContent =
    `${describeMap(map, center)} · ศูนย์กลาง ${lat.toFixed(6)}, ${lon.toFixed(6)} · ` +
    `${map.width}×${map.height} ช่อง ช่องละ ${map.tileSizeM} ม.` +
    (map.flags.length ? ` · ⚠ ${map.flags.map((f) => FLAG_TEXT[f] ?? f).join(" / ")}` : "");
  (document.getElementById("detailOverride") as HTMLElement).textContent =
    `"${province.id}": { "lat": ${lat.toFixed(6)}, "lon": ${lon.toFixed(6)} }`;
  (document.getElementById("detailOsm") as HTMLAnchorElement).href =
    `https://www.openstreetmap.org/#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;
  dialog.showModal();
}

function buildCard(province: Province, map: PresetMap | null, center: CenterInfo | undefined): HTMLElement {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.flagged = String(!map || map.flags.length > 0);

  if (map) {
    const canvas = document.createElement("canvas");
    drawMap(canvas, map, CARD_PIXELS_PER_TILE);
    card.appendChild(canvas);
    card.addEventListener("click", () => openDetail(province, map, center));
  } else {
    const missing = document.createElement("div");
    missing.className = "missing";
    missing.textContent = "ยังไม่มีแผนที่";
    card.appendChild(missing);
  }

  const title = document.createElement("h3");
  title.textContent = `${province.nameTh} · ${province.id}`;
  card.appendChild(title);

  if (map) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = describeMap(map, center);
    card.appendChild(meta);
  }

  const flags = map ? map.flags.map((f) => FLAG_TEXT[f] ?? f) : [];
  if (flags.length) {
    const flagLine = document.createElement("div");
    flagLine.className = "flags";
    flagLine.textContent = `⚠ ${flags.join(" / ")}`;
    card.appendChild(flagLine);
  }
  return card;
}

async function main(): Promise<void> {
  const data = await loadJson<{ regions: Region[]; provinces: Province[] }>("data/thailand-provinces.json");
  const centers = await loadJson<{ centers: Record<string, CenterInfo> }>("data/geo/province-centers.json");
  const overrides = await loadJson<Record<string, unknown>>("data/geo/center-overrides.json") ?? {};
  const summary = document.getElementById("summary") as HTMLElement;
  if (!data) {
    summary.textContent = "โหลด data/thailand-provinces.json ไม่ได้";
    return;
  }

  const maps = new Map<string, PresetMap | null>();
  await Promise.all(data.provinces.map(async (p) => {
    maps.set(p.id, await loadJson<PresetMap>(`data/maps/${p.id}.json`));
  }));

  const container = document.getElementById("regions") as HTMLElement;
  for (const region of data.regions) {
    const heading = document.createElement("h2");
    heading.textContent = region.nameTh;
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const province of data.provinces.filter((p) => p.region === region.id)) {
      const center: CenterInfo | undefined = province.id in overrides
        ? { source: "override" }
        : centers?.centers[province.id];
      grid.appendChild(buildCard(province, maps.get(province.id) ?? null, center));
    }
    container.append(heading, grid);
  }

  const built = [...maps.values()].filter((m): m is PresetMap => m !== null);
  const flagged = built.filter((m) => m.flags.length > 0).length;
  const size = built[0] ? `${built[0].width}×${built[0].height} ช่อง (ช่องละ ${built[0].tileSizeM} ม.)` : "";
  summary.textContent = `มีแผนที่ ${built.length} จาก ${data.provinces.length} จังหวัด · มี flag ${flagged} · ${size}`;

  const flaggedOnly = document.getElementById("flaggedOnly") as HTMLInputElement;
  flaggedOnly.addEventListener("change", () => {
    for (const card of Array.from(container.querySelectorAll<HTMLElement>(".card"))) {
      card.hidden = flaggedOnly.checked && card.dataset.flagged !== "true";
    }
  });
}

main();
