import "./env";
import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { PgProductRepository } from "@/src/infrastructure/repositories/postgres/pg-product-repository";
import { PgStoreRepository } from "@/src/infrastructure/repositories/postgres/pg-store-repository";

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

async function migrateSubdir(
  subdir: "stores" | "products",
  updateRow: (entityId: string, url: string) => Promise<void>,
): Promise<void> {
  const dir = path.join(UPLOADS_DIR, subdir);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  if (files.length === 0) {
    console.log(`${subdir}/: nothing to migrate`);
    return;
  }

  for (const fileName of files) {
    const entityId = fileName.slice(0, fileName.lastIndexOf("."));
    const buffer = await fs.readFile(path.join(dir, fileName));
    const blob = await put(`${subdir}/${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    await updateRow(entityId, blob.url);
    console.log(`${subdir}/${fileName}: uploaded -> ${blob.url}`);
  }
}

async function main() {
  const storeRepo = new PgStoreRepository();
  const productRepo = new PgProductRepository();

  await migrateSubdir("stores", (entityId, url) =>
    storeRepo.update(entityId, { mapImageUrl: url }).then(() => undefined),
  );
  await migrateSubdir("products", (entityId, url) =>
    productRepo.update(entityId, { imageUrl: url }).then(() => undefined),
  );

  console.log("Image migration to Vercel Blob complete.");
}

main().catch((err) => {
  console.error("Image migration failed:", err);
  process.exitCode = 1;
});
