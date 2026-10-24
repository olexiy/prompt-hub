import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  isSafeEntryName,
  projectBundleSchema,
  projectZipStream,
  readProjectZip,
  ZIP_LIMITS,
  type ProjectBundle,
} from "./projectzip";

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const zip = (files: Record<string, string | Uint8Array>) =>
  zipSync(
    Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, typeof v === "string" ? strToU8(v) : v]),
    ),
  );

const bundle: ProjectBundle = {
  slug: "comfy-h3",
  name: "Comfy H3",
  description: "Video prompts",
  tags: ["video"],
  folders: [
    { path: ["shots"], name: "Shots" },
    { path: ["shots", "rain"], name: "Дождь" },
  ],
  prompts: [
    {
      folder: [],
      slug: "readme",
      title: "Read me",
      body: "Plain",
      variables: [],
      tags: [],
      meta: {},
    },
    {
      folder: ["shots", "rain"],
      slug: "girl",
      title: "Девушка",
      body: "---\nЖдёт {{время}}. Größe {{g}}",
      variables: [{ name: "время", default: "ночь" }],
      tags: ["h3", "видео"],
      meta: { note: "secret", Model: "H3" },
    },
  ],
};

describe("project zip", () => {
  it("round-trips export → import", async () => {
    const bytes = await collect(projectZipStream(bundle));
    const read = readProjectZip(bytes, "whatever.zip");
    expect(read).toEqual({ ok: true, bundle, skipped: [] });
  });

  it("imports a plain zipped folder of text files, naming things from paths", () => {
    const read = readProjectZip(
      zip({
        "Мои промпты/Видео/Дождь.md": "# Rain shot\nText",
        "Мои промпты/Видео/дождь.txt": "Same slug, other file",
        "Мои промпты/日本.md": "cjk name",
        "Мои промпты/picture.png": new Uint8Array([1, 2]),
        "Мои промпты/.DS_Store": "x",
        "__MACOSX/Мои промпты/._Дождь.md": "x",
      }),
      "export.zip",
    );
    if (!read.ok) throw new Error(read.error);
    expect(read.bundle).toMatchObject({ slug: "moi-prompty", name: "Мои промпты" });
    expect(read.bundle.folders).toEqual([{ path: ["video"], name: "Видео" }]);
    expect(read.bundle.prompts.map((p) => [p.folder.join("/"), p.slug, p.title])).toEqual([
      ["video", "dozhd", "Rain shot"],
      ["video", "dozhd-2", "дождь"],
      ["", "prompt-3", "日本"],
    ]);
    expect(read.skipped).toEqual(["picture.png"]);
  });

  it("rejects unsafe entry names anywhere in the archive", () => {
    for (const name of [
      "../evil.md",
      "a/../../evil.md",
      "/etc/x.md",
      "C:/x.md",
      "a\\b.md",
      "./a.md",
    ]) {
      expect(isSafeEntryName(name), name).toBe(false);
      const read = readProjectZip(zip({ "ok.md": "fine", [name]: "evil" }), "x.zip");
      expect(read, name).toMatchObject({ ok: false, error: "unsafePath" });
    }
    expect(isSafeEntryName("a/b/c.md")).toBe(true);
    expect(isSafeEntryName("dir/")).toBe(true);
  });

  it("stops zip bombs and oversized archives before or right after inflating", () => {
    const zeros = new Uint8Array(30 * 1024 * 1024);
    expect(readProjectZip(zip({ "bomb.md": zeros }), "b.zip")).toMatchObject({
      ok: false,
      error: "fileTooLarge",
    });
    const many: Record<string, string> = {};
    for (let i = 0; i <= ZIP_LIMITS.entries; i++) many[`p${String(i)}.md`] = "x";
    expect(readProjectZip(zip(many), "m.zip")).toMatchObject({
      ok: false,
      error: "tooManyEntries",
    });
    const big = "x".repeat(200 * 1024);
    const heavy: Record<string, string> = {};
    for (let i = 0; i < 110; i++) heavy[`p${String(i)}.md`] = big;
    expect(readProjectZip(zip(heavy), "h.zip")).toMatchObject({ ok: false, error: "tooLarge" });
  });

  it("rejects non-zips, empty archives, deep trees and broken metadata", () => {
    expect(readProjectZip(strToU8("not a zip"), "x.zip")).toMatchObject({ error: "notZip" });
    expect(readProjectZip(zip({ "a.png": "x" }), "x.zip")).toMatchObject({ error: "empty" });
    const deep = `${Array.from({ length: 8 }, (_, i) => `d${String(i)}`).join("/")}/p.md`;
    // A root file keeps the top directory from counting as a wrapper.
    expect(readProjectZip(zip({ "top.md": "x", [deep]: "x" }), "x.zip")).toMatchObject({
      error: "tooDeep",
    });
    expect(readProjectZip(zip({ "project.json": "{oops", "a.md": "x" }), "x.zip")).toMatchObject({
      error: "badProjectJson",
    });
    expect(
      readProjectZip(zip({ "project.json": '{"format":"other/9"}', "a.md": "x" }), "x.zip"),
    ).toMatchObject({ error: "badProjectJson" });
    expect(readProjectZip(zip({ "a.md": new Uint8Array([0xc3, 0x28]) }), "x.zip")).toMatchObject({
      error: "badFile",
      detail: "a.md",
    });
    expect(readProjectZip(zip({ "a.md": "---\ntags: [x\n---\nb" }), "x.zip")).toMatchObject({
      error: "badFile",
    });
  });

  it("the bundle schema refuses orphans, duplicates and bad slugs", () => {
    const base = { slug: "p", name: "P", folders: [], prompts: [] };
    const prompt = { slug: "a", title: "A", body: "x" };
    expect(projectBundleSchema.safeParse(base).success).toBe(true);
    for (const bad of [
      { ...base, folders: [{ path: ["a", "b"], name: "B" }] },
      { ...base, prompts: [{ ...prompt, folder: ["missing"] }] },
      {
        ...base,
        prompts: [
          { ...prompt, folder: [] },
          { ...prompt, folder: [] },
        ],
      },
      {
        ...base,
        folders: [{ path: ["a"], name: "A" }],
        prompts: [{ ...prompt, folder: [] }],
      },
      { ...base, prompts: [{ ...prompt, folder: [], slug: "../x" }] },
      { ...base, slug: "settings" },
    ]) {
      expect(projectBundleSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
