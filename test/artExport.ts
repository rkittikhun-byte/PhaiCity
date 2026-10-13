/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The art export page's helpers (src/admin/artExport.ts, docs/3d/ART_ARCHIVE.md): which models it exports, and how
// it points their textures and geometry at files shared within a run.

import { webcrypto } from "node:crypto";
import { Texture } from "three";
import { exportable, exportJobs, readableName, shareTextures, textureFile, unpackFile } from "../src/admin/artExport";
import { registry } from "../src/render3d/models/registry";
import { REGIONS } from "../src/render3d/regional/types";

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, "crypto", { value: webcrypto });

const PAGE = "http://localhost:8099/art-export.html";
const image = (value: object) => new Texture(value as unknown as HTMLImageElement);

describe("art export", () => {
  test("exports every model but the debug ones, the regional ones once a region, each to its own file", () => {
    const jobs = exportJobs(true);
    const ids = new Set(jobs.map((job) => job.id));
    for (const [id, entry] of Object.entries(registry)) {
      expect([id, ids.has(id)]).toEqual([id, entry.category !== "debug"]);
    }
    const files = jobs.map((job) => job.file);
    expect(new Set(files).size).toBe(files.length);
    for (const file of files) expect(file).toMatch(/^models\/[a-z]+\/[A-Za-z0-9_.@-]+\.gltf$/);
    expect(jobs.filter((job) => job.id === "svc.police").map((job) => job.region)).toEqual([...REGIONS]);
    expect(jobs.filter((job) => job.id === "svc.stadium").map((job) => job.name))
      .toEqual(["svc.stadium-empty", "svc.stadium-game"]);
    expect(exportJobs(false).filter((job) => job.id === "svc.police")).toHaveLength(1);
  });

  test("knows a texture from the project's files from one drawn in code", () => {
    expect(textureFile(image({ src: "http://localhost:8099/assets/textures/sources/clay_roof_tiles/color.jpg" }), PAGE))
      .toBe("assets/textures/sources/clay_roof_tiles/color.jpg");
    expect(textureFile(image({ src: "http://localhost:8099/images/logo.png" }), PAGE)).toBeNull();
    expect(textureFile(image({ width: 1, height: 1, data: new Uint8Array(4) }), PAGE)).toBeNull();
    expect(exportable(image({ width: 1, height: 1, data: new Uint8Array(4) }))).toBe(true);
    expect(exportable(new Texture())).toBe(false);
  });

  test("names a sign's material by its first sign, and leaves other names alone", () => {
    const atlas = JSON.stringify([{ text: "ตลาดร่มไม้", size: [2.5, 0.46] }, { text: "ขนมพื้นบ้าน", size: [2.5, 0.46] }]);
    expect(readableName(`sign_thai:atlas:${atlas}`)).toBe("sign_thai · ตลาดร่มไม้");
    expect(readableName("sign_thai:atlas:[not json]")).toBe("sign_thai");
    expect(readableName("foliage_tropical#668949")).toBe("foliage_tropical#668949");
  });

  test("points stand-in textures at the run's shared texture files", () => {
    const json = {
      asset: {},
      images: [{ uri: "data:image/jpeg;base64,AAAA" }, { uri: "data:image/png;base64,BBBB" }],
      textures: [{ name: "assets/textures/sources/bamboo_veneer/color.jpg", source: 0 }, { source: 1 }],
    };
    shareTextures(json);
    expect(json.images[0]).toEqual({
      name: "sources/bamboo_veneer/color.jpg", uri: "../../assets/textures/sources/bamboo_veneer/color.jpg",
      mimeType: "image/jpeg",
    });
    expect(json.images[1]).toEqual({ uri: "data:image/png;base64,BBBB" });
  });

  test("moves the geometry beside the file and writes each drawn image once a run", async () => {
    const uploads = new Map<string, string | Uint8Array>();
    const written = new Set<string>();
    const upload = async (file: string, body: string | Uint8Array) => { uploads.set(file, body); };
    const png = Buffer.from([137, 80, 78, 71, 13, 10]).toString("base64");
    const file = () => ({
      asset: {},
      buffers: [{ byteLength: 3, uri: `data:application/octet-stream;base64,${Buffer.from([1, 2, 3]).toString("base64")}` }],
      images: [{ uri: `data:image/png;base64,${png}` }],
    });

    const first = file();
    await unpackFile(first, { name: "res.house_0@north", file: "models/residential/res.house_0@north.gltf" }, upload, written);
    expect(first.buffers[0].uri).toBe("res.house_0%40north.bin");
    expect([...(uploads.get("models/residential/res.house_0@north.bin") as Uint8Array)]).toEqual([1, 2, 3]);
    expect(first.images[0].uri).toMatch(/^\.\.\/\.\.\/generated\/[0-9a-f]{24}\.png$/);

    const second = file();
    await unpackFile(second, { name: "res.house_1", file: "models/residential/res.house_1.gltf" }, upload, written);
    expect(second.images[0].uri).toBe(first.images[0].uri);
    expect([...uploads.keys()].filter((name) => name.startsWith("generated/"))).toHaveLength(1);
  });
});
