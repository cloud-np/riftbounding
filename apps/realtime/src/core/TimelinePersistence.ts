/**
 * Durable Object persistence for the server-only rewind timeline.
 *
 * Why this exists
 * ---------------
 * `MatchRoomCore.timeline` stores the complete `Room` before every meaningful action (protocol v5:
 * rewinding must restore hidden hands, deck order, face-down cards, logs, etc. exactly). Writing
 * that array inside the room's single `state` value does not scale: a long game is hundreds of
 * snapshots, and the Durable Object storage value would grow past the platform limit.
 *
 * Cloudflare limits (SQLite-backed Durable Objects, which `wrangler.jsonc` declares with
 * `new_sqlite_classes`): one key+value may be at most **2 MB** combined, a key at most 2 KiB, and
 * one object may hold **10 GB** total ([Durable Objects limits][limits]). We therefore store:
 *
 *   timeline:meta          version, cursor, seq ids, pending confirmation, forward pointer
 *   timeline:e:<seq>       one chunked JSON snapshot per meaningful action
 *   timeline:f             the snapshot saved by `forward_last_rewind` (chunked)
 *
 * Every chunk is capped well below the 2 MB platform limit, so no single value can fail. Entries
 * are keyed by the engine's monotonic `seq`, so appending is one write and pruning is a delete; the
 * timeline is never rewritten as a whole. `list()`/`get()` reassemble it after a Durable Object
 * restart, preserving rewind/forward/confirmation state.
 *
 * The engine bounds the number of entries (`MAX_REWIND_ENTRIES`) to keep the per-object total
 * bounded as well. A 4096-entry history of typical rooms is tens of MB, far below 10 GB.
 *
 * [limits]: https://developers.cloudflare.com/durable-objects/platform/limits/
 */

import type {
  EngineTimeline,
  EngineTimelineEntry,
  RewindConfirmation,
  Room,
} from "@rift/protocol";

/** Cloudflare SQLite-backed DO: key + value combined must stay under 2 MiB. */
export const DO_STORAGE_VALUE_LIMIT_BYTES = 2 * 1024 * 1024;
/** Leave headroom for the key, structured-clone overhead and future runtime changes. */
export const TIMELINE_CHUNK_BYTES = 512 * 1024;

export const TIMELINE_META_KEY = "timeline:meta";
export const TIMELINE_ENTRY_PREFIX = "timeline:e:";
export const TIMELINE_FORWARD_KEY = "timeline:f";

export interface TimelineStorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<unknown>;
}

interface ChunkHeader {
  v: 1;
  chunks: number;
  bytes: number;
  /** Present when `chunks === 1`; larger records store `key:0`, `key:1`, … instead. */
  data?: string;
}

interface ForwardMeta {
  actorId: string;
  expiresAt: number;
}

interface TimelineMeta {
  v: 2;
  seqs: number[];
  cursor: number;
  nextSeq: number;
  pending?: RewindConfirmation;
  forward?: ForwardMeta;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMeta(value: unknown): TimelineMeta | null {
  if (!isRecord(value) || value.v !== 2) return null;
  const seqs = Array.isArray(value.seqs)
    ? value.seqs.filter((seq): seq is number => typeof seq === "number" && Number.isInteger(seq))
    : null;
  if (!seqs || typeof value.cursor !== "number" || typeof value.nextSeq !== "number") return null;
  const pending = isRecord(value.pending)
    ? (value.pending as unknown as RewindConfirmation)
    : undefined;
  const forward =
    isRecord(value.forward) &&
    typeof value.forward.actorId === "string" &&
    typeof value.forward.expiresAt === "number"
      ? { actorId: value.forward.actorId, expiresAt: value.forward.expiresAt }
      : undefined;
  return {
    v: 2,
    seqs,
    cursor: value.cursor,
    nextSeq: value.nextSeq,
    ...(pending ? { pending } : {}),
    ...(forward ? { forward } : {}),
  };
}

function splitJson(json: string, limitBytes: number): string[] {
  const encoder = new TextEncoder();
  if (encoder.encode(json).byteLength <= limitBytes) return [json];
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of json) {
    const bytes = encoder.encode(character).byteLength;
    if (currentBytes + bytes > limitBytes && current.length > 0) {
      parts.push(current);
      current = character;
      currentBytes = bytes;
    } else {
      current += character;
      currentBytes += bytes;
    }
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function chunkKeys(key: string, chunks: number): string[] {
  const keys: string[] = [];
  for (let index = 0; index < chunks; index += 1) keys.push(`${key}:${index}`);
  return keys;
}

/** Write one JSON value, splitting it across storage keys when it is too large for one value. */
async function writeChunked(
  storage: TimelineStorageAdapter,
  key: string,
  value: unknown,
  previousChunks = 0,
): Promise<number> {
  const json = JSON.stringify(value);
  const parts = splitJson(json, TIMELINE_CHUNK_BYTES);
  const bytes = new TextEncoder().encode(json).byteLength;
  const header: ChunkHeader =
    parts.length === 1
      ? { v: 1, chunks: 1, bytes, data: parts[0] }
      : { v: 1, chunks: parts.length, bytes };
  await storage.put(key, header);
  if (parts.length > 1) {
    for (const [index, part] of parts.entries()) await storage.put(`${key}:${index}`, part);
  }
  // Remove leftovers if this record got shorter (e.g. the forward snapshot after a smaller game).
  for (let index = parts.length; index < previousChunks; index += 1) {
    await storage.delete(`${key}:${index}`);
  }
  return parts.length;
}

async function readChunked<T>(storage: TimelineStorageAdapter, key: string): Promise<T | null> {
  const header = (await storage.get<ChunkHeader>(key)) as ChunkHeader | undefined;
  if (!isRecord(header) || header.v !== 1 || typeof header.chunks !== "number") return null;
  let json: string;
  if (header.chunks === 1) {
    if (typeof header.data !== "string") return null;
    json = header.data;
  } else {
    const parts: string[] = [];
    for (let index = 0; index < header.chunks; index += 1) {
      const part = await storage.get<string>(`${key}:${index}`);
      if (typeof part !== "string") return null;
      parts.push(part);
    }
    json = parts.join("");
  }
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function deleteChunked(
  storage: TimelineStorageAdapter,
  key: string,
  chunks: number,
): Promise<void> {
  await storage.delete(key);
  for (const partKey of chunkKeys(key, chunks)) await storage.delete(partKey);
}

function entryKey(seq: number): string {
  return `${TIMELINE_ENTRY_PREFIX}${seq}`;
}

function maxSeq(seqs: readonly number[]): number {
  let highest = -1;
  for (const seq of seqs) if (seq > highest) highest = seq;
  return highest;
}

/** Persistence handle for one Durable Object. Reuse it for the lifetime of the DO instance. */
export class TimelinePersistence {
  private readonly storage: TimelineStorageAdapter;
  /** Seq ids currently stored, in timeline order. */
  private storedSeqs: number[] = [];
  /** Entry object references already stored, keyed by seq (skip unchanged writes). */
  private storedEntries = new Map<number, EngineTimelineEntry>();
  private storedChunks = new Map<number, number>();
  private forwardChunks = 0;
  private forwardSignature: string | null = null;
  private metaSignature: string | null = null;

  private constructor(storage: TimelineStorageAdapter) {
    this.storage = storage;
  }

  /** Load an existing v2 timeline. Returns an empty handle when none/legacy is present. */
  static async load(
    storage: TimelineStorageAdapter,
  ): Promise<{ persistence: TimelinePersistence; timeline: EngineTimeline | null }> {
    const persistence = new TimelinePersistence(storage);
    const meta = parseMeta(await storage.get<unknown>(TIMELINE_META_KEY));
    if (!meta) return { persistence, timeline: null };

    const entries: EngineTimelineEntry[] = [];
    const seqs: number[] = [];
    for (const seq of meta.seqs) {
      const entry = await readChunked<EngineTimelineEntry>(storage, entryKey(seq));
      if (!entry) break; // stop at the first missing/corrupt entry; the recent history is still usable
      const header = await storage.get<ChunkHeader>(entryKey(seq));
      entries.push({ ...entry, seq });
      seqs.push(seq);
      persistence.storedEntries.set(seq, entries[entries.length - 1]!);
      persistence.storedChunks.set(
        seq,
        isRecord(header) && typeof header.chunks === "number" ? header.chunks : 1,
      );
    }
    persistence.storedSeqs = seqs;
    const nextSeq = Math.max(meta.nextSeq, maxSeq(seqs) + 1);
    if (seqs.length === 0 && meta.seqs.length > 0) return { persistence, timeline: null };

    let forward: EngineTimeline["forward"];
    if (meta.forward) {
      const state = await readChunked<Room>(storage, TIMELINE_FORWARD_KEY);
      if (state) {
        forward = { actorId: meta.forward.actorId, state, expiresAt: meta.forward.expiresAt };
        const header = await storage.get<ChunkHeader>(TIMELINE_FORWARD_KEY);
        persistence.forwardChunks =
          isRecord(header) && typeof header.chunks === "number" ? header.chunks : 1;
        persistence.forwardSignature = JSON.stringify(forward);
      }
    }
    persistence.metaSignature = JSON.stringify(meta);
    return {
      persistence,
      timeline: {
        version: 1,
        entries,
        cursor: Math.min(Math.max(0, meta.cursor), entries.length),
        nextSeq,
        ...(meta.pending ? { pending: meta.pending } : {}),
        ...(forward ? { forward } : {}),
      },
    };
  }

  /**
   * Persist the current timeline. Only new/changed entries are written; entries removed by a
   * branch are deleted. Metadata is written last, so an interrupted write leaves the previous
   * consistent history in place (new entries become harmless orphans).
   */
  async save(timeline: EngineTimeline): Promise<void> {
    let nextSeq = Math.max(timeline.nextSeq ?? 0, maxSeq(this.storedSeqs) + 1);
    const entries = timeline.entries.map((entry) => {
      if (typeof entry.seq !== "number" || !Number.isInteger(entry.seq)) {
        // One-time migration for legacy timelines; keep the id on the shared entry object so the
        // next save skips it (the array itself is immutable to the engine).
        entry.seq = nextSeq++;
      }
      if (entry.seq >= nextSeq) nextSeq = entry.seq + 1;
      return entry;
    });
    const seqs = entries.map((entry) => entry.seq!);
    const seqSet = new Set(seqs);

    for (const seq of this.storedSeqs) {
      if (seqSet.has(seq)) continue;
      await deleteChunked(this.storage, entryKey(seq), this.storedChunks.get(seq) ?? 1);
      this.storedEntries.delete(seq);
      this.storedChunks.delete(seq);
    }

    for (const entry of entries) {
      const seq = entry.seq!;
      if (this.storedEntries.get(seq) === entry) {
        this.storedEntries.set(seq, entry);
        continue;
      }
      const chunks = await writeChunked(
        this.storage,
        entryKey(seq),
        entry,
        this.storedChunks.get(seq) ?? 0,
      );
      this.storedEntries.set(seq, entry);
      this.storedChunks.set(seq, chunks);
    }
    this.storedSeqs = seqs;

    const forward = timeline.forward;
    if (forward) {
      const signature = JSON.stringify(forward);
      if (signature !== this.forwardSignature) {
        this.forwardChunks = await writeChunked(
          this.storage,
          TIMELINE_FORWARD_KEY,
          forward.state,
          this.forwardChunks,
        );
        this.forwardSignature = signature;
      }
    } else if (this.forwardSignature !== null || this.forwardChunks > 0) {
      await deleteChunked(this.storage, TIMELINE_FORWARD_KEY, this.forwardChunks);
      this.forwardChunks = 0;
      this.forwardSignature = null;
    }

    const meta: TimelineMeta = {
      v: 2,
      seqs,
      cursor: Math.min(Math.max(0, timeline.cursor), entries.length),
      nextSeq: Math.max(nextSeq, maxSeq(seqs) + 1),
      ...(timeline.pending ? { pending: timeline.pending } : {}),
      ...(forward ? { forward: { actorId: forward.actorId, expiresAt: forward.expiresAt } } : {}),
    };
    const metaSignature = JSON.stringify(meta);
    if (metaSignature !== this.metaSignature) {
      await this.storage.put(TIMELINE_META_KEY, meta);
      this.metaSignature = metaSignature;
    }
  }

  /** Test/maintenance hook: remove every key owned by the timeline. */
  async clear(): Promise<void> {
    for (const seq of this.storedSeqs) {
      await deleteChunked(this.storage, entryKey(seq), this.storedChunks.get(seq) ?? 1);
    }
    await deleteChunked(this.storage, TIMELINE_FORWARD_KEY, this.forwardChunks);
    await this.storage.delete(TIMELINE_META_KEY);
    this.storedSeqs = [];
    this.storedEntries.clear();
    this.storedChunks.clear();
    this.forwardChunks = 0;
    this.forwardSignature = null;
    this.metaSignature = null;
  }
}
