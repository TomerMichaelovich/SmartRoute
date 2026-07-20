import { promises as fs } from "fs";
import path from "path";
import type { ZodType } from "zod";

const DATA_DIR = path.join(process.cwd(), "data");

async function writeFileAtomic(filePath: string, contents: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, contents, "utf-8");
  await fs.rename(tmpPath, filePath);
}

async function readFileOrNull(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * A promise chain that serializes async tasks so concurrent read-modify-write
 * calls within a single Node process never interleave. Each JsonFileStore /
 * JsonObjectFileStore instance owns its own queue (scoped to one file).
 */
class TaskQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Atomic-write JSON store for a collection file shaped as a flat array of T.
 * Not safe across multiple processes/instances (e.g. serverless) - that's the
 * documented trigger to migrate to SQLite/Supabase, not a bug to fix here.
 */
export class JsonFileStore<T> {
  private readonly queue = new TaskQueue();

  constructor(
    private readonly fileName: string,
    private readonly schema: ZodType<T>,
  ) {}

  private get filePath(): string {
    return path.join(DATA_DIR, this.fileName);
  }

  async readAll(): Promise<T[]> {
    const raw = await readFileOrNull(this.filePath);
    if (raw === null || !raw.trim()) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error(`${this.fileName}: expected a JSON array at the top level`);
    }
    return parsed.map((item, i) => {
      const result = this.schema.safeParse(item);
      if (!result.success) {
        throw new Error(`${this.fileName}[${i}]: ${result.error.message}`);
      }
      return result.data;
    });
  }

  async writeAll(items: T[]): Promise<void> {
    await this.queue.run(() => this.writeAtomic(items));
  }

  /** Read-modify-write, serialized through this store's queue. */
  async mutate(mutator: (items: T[]) => T[]): Promise<T[]> {
    return this.queue.run(async () => {
      const items = await this.readAll();
      const next = mutator(items);
      await this.writeAtomic(next);
      return next;
    });
  }

  private async writeAtomic(items: T[]): Promise<void> {
    const validated = items.map((item) => this.schema.parse(item));
    await writeFileAtomic(this.filePath, JSON.stringify(validated, null, 2));
  }
}

/**
 * Atomic-write JSON store for a file shaped as a single key -> value object
 * (used by the classification cache: normalizedText -> ClassificationResult).
 */
export class JsonObjectFileStore<T> {
  private readonly queue = new TaskQueue();

  constructor(
    private readonly fileName: string,
    private readonly schema: ZodType<T>,
  ) {}

  private get filePath(): string {
    return path.join(DATA_DIR, this.fileName);
  }

  async readAll(): Promise<Record<string, T>> {
    const raw = await readFileOrNull(this.filePath);
    if (raw === null || !raw.trim()) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(`${this.fileName}: expected a JSON object at the top level`);
    }
    const out: Record<string, T> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const result = this.schema.safeParse(value);
      if (!result.success) {
        throw new Error(`${this.fileName}[${key}]: ${result.error.message}`);
      }
      out[key] = result.data;
    }
    return out;
  }

  async get(key: string): Promise<T | null> {
    const all = await this.readAll();
    return all[key] ?? null;
  }

  async set(key: string, value: T): Promise<void> {
    await this.queue.run(async () => {
      const all = await this.readAll();
      all[key] = this.schema.parse(value);
      await writeFileAtomic(this.filePath, JSON.stringify(all, null, 2));
    });
  }

  async delete(key: string): Promise<void> {
    await this.queue.run(async () => {
      const all = await this.readAll();
      delete all[key];
      await writeFileAtomic(this.filePath, JSON.stringify(all, null, 2));
    });
  }
}

/** Append-only JSON Lines store (one JSON object per line) - used for analytics events. */
export class JsonLinesFileStore<T> {
  private readonly queue = new TaskQueue();

  constructor(
    private readonly fileName: string,
    private readonly schema: ZodType<T>,
  ) {}

  private get filePath(): string {
    return path.join(DATA_DIR, this.fileName);
  }

  async append(item: T): Promise<void> {
    const validated = this.schema.parse(item);
    await this.queue.run(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.appendFile(this.filePath, `${JSON.stringify(validated)}\n`, "utf-8");
    });
  }

  async readAll(): Promise<T[]> {
    const raw = await readFileOrNull(this.filePath);
    if (raw === null || !raw.trim()) return [];
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line, i) => {
        const result = this.schema.safeParse(JSON.parse(line));
        if (!result.success) {
          throw new Error(`${this.fileName}:${i + 1}: ${result.error.message}`);
        }
        return result.data;
      });
  }
}
