import { promises as fs } from "fs";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  JsonFileStore,
  JsonLinesFileStore,
  JsonObjectFileStore,
} from "@/src/infrastructure/repositories/json/json-file-store";

const itemSchema = z.object({ id: z.string(), value: z.number() });
type Item = z.infer<typeof itemSchema>;

const ARRAY_FILE = "test-roundtrip-array.json";
const OBJECT_FILE = "test-roundtrip-object.json";
const LINES_FILE = "test-roundtrip-lines.jsonl";

async function cleanup(fileName: string) {
  await fs.rm(path.join(process.cwd(), "data", fileName), { force: true });
}

afterEach(async () => {
  await cleanup(ARRAY_FILE);
  await cleanup(OBJECT_FILE);
  await cleanup(LINES_FILE);
});

describe("JsonFileStore", () => {
  it("returns an empty array when the file does not exist", async () => {
    const store = new JsonFileStore<Item>(ARRAY_FILE, itemSchema);
    expect(await store.readAll()).toEqual([]);
  });

  it("round-trips writeAll -> readAll", async () => {
    const store = new JsonFileStore<Item>(ARRAY_FILE, itemSchema);
    const items: Item[] = [
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ];
    await store.writeAll(items);
    expect(await store.readAll()).toEqual(items);
  });

  it("serializes concurrent mutate() calls without lost updates", async () => {
    const store = new JsonFileStore<Item>(ARRAY_FILE, itemSchema);
    await store.writeAll([]);

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.mutate((items) => [...items, { id: `item-${i}`, value: i }]),
      ),
    );

    const result = await store.readAll();
    expect(result).toHaveLength(20);
    const ids = new Set(result.map((r) => r.id));
    expect(ids.size).toBe(20);
  });

  it("throws when a stored item fails schema validation", async () => {
    const filePath = path.join(process.cwd(), "data", ARRAY_FILE);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify([{ id: "a" }]), "utf-8");

    const store = new JsonFileStore<Item>(ARRAY_FILE, itemSchema);
    await expect(store.readAll()).rejects.toThrow();
  });
});

describe("JsonObjectFileStore", () => {
  it("round-trips set -> get and supports delete", async () => {
    const store = new JsonObjectFileStore<Item>(OBJECT_FILE, itemSchema);
    await store.set("key-1", { id: "key-1", value: 42 });
    expect(await store.get("key-1")).toEqual({ id: "key-1", value: 42 });

    await store.delete("key-1");
    expect(await store.get("key-1")).toBeNull();
  });
});

describe("JsonLinesFileStore", () => {
  it("appends lines and reads them all back", async () => {
    const store = new JsonLinesFileStore<Item>(LINES_FILE, itemSchema);
    await store.append({ id: "a", value: 1 });
    await store.append({ id: "b", value: 2 });
    expect(await store.readAll()).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
  });
});
