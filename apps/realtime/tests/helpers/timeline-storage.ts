import type { TimelineStorageAdapter } from "../../src/core/TimelinePersistence";

/** In-memory Durable Object storage facade with Cloudflare's per-key/value limit enforced. */
export class FakeTimelineStorage implements TimelineStorageAdapter {
  readonly values = new Map<string, unknown>();
  readonly byteSizes = new Map<string, number>();
  readonly writes: string[] = [];
  readonly deletes: string[] = [];
  maxValueBytes = 0;

  constructor(readonly limitBytes = 2 * 1024 * 1024) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (bytes + new TextEncoder().encode(key).byteLength > this.limitBytes) {
      throw new RangeError(`Value for ${key} is ${bytes} bytes (limit ${this.limitBytes}).`);
    }
    this.maxValueBytes = Math.max(this.maxValueBytes, bytes);
    this.values.set(key, value);
    this.byteSizes.set(key, bytes);
    this.writes.push(key);
  }

  async delete(key: string): Promise<boolean> {
    this.deletes.push(key);
    this.byteSizes.delete(key);
    return this.values.delete(key);
  }

  totalBytes(): number {
    let total = 0;
    for (const bytes of this.byteSizes.values()) total += bytes;
    return total;
  }

  keysWithPrefix(prefix: string): string[] {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }
}
