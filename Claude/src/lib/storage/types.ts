export interface StorageProvider {
  /** Persist a file and return its storage key (opaque to callers). */
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  /** Resolve a storage key to a URL the browser/provider can fetch. */
  resolveUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}
