import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

const COLLECTION_FILES = [
  "stores.json",
  "nodes.json",
  "edges.json",
  "products.json",
  "promotions.json",
  "classification-cache.json",
  "shopping-lists.json",
  "routes.json",
];

const LINES_FILES = ["analytics-events.jsonl"];

export async function resetData(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await Promise.all(
    COLLECTION_FILES.map((file) => fs.writeFile(path.join(DATA_DIR, file), "[]", "utf-8")),
  );
  await Promise.all(
    LINES_FILES.map((file) => fs.writeFile(path.join(DATA_DIR, file), "", "utf-8")),
  );
}

async function main() {
  await resetData();
  console.log("Data directory reset to empty collections.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  });
}
