import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import type { StorageProvider } from "./types";

const STORAGE_ROOT = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), ".storage");

/**
 * Dev-only StorageProvider backed by the local filesystem. Swap for an
 * S3-compatible implementation in production without touching callers —
 * everything goes through the StorageProvider interface.
 */
export const localStorageProvider: StorageProvider = {
  async put(key, data) {
    const filePath = path.join(STORAGE_ROOT, key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  },

  async resolveUrl(key) {
    return `/api/storage/${encodeURIComponent(key)}`;
  },

  async delete(key) {
    const filePath = path.join(STORAGE_ROOT, key);
    await rm(filePath, { force: true });
  },
};

export async function readLocalAsset(key: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_ROOT, key);
  return readFile(filePath);
}
