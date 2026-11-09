/**
 * Strict repro export / replay.
 *
 * Choice: the existing protocol-v5 timeline already stores a full `Room` snapshot before every
 * meaningful action (`EngineTimelineEntry.before`). That snapshot includes `Room.rules` (chain,
 * prompts, priority/focus, combat/showdown, control, hidden records, per-turn history) plus the
 * seeded RNG cursor, so a rewind is an exact restore, never a recomputation. Repro export reuses
 * those snapshots and adds the action payloads; replay applies the same actions through
 * `applyGameAction`.
 */
import type {
  EngineTimeline,
  Room,
  StrictReproAction,
  StrictReproFile,
} from "@rift/protocol";
import {
  STRICT_REPRO_FORMAT,
  STRICT_REPRO_VERSION,
} from "@rift/protocol";
import type { ActionContext } from "../types";
import { applyGameAction } from "../engine";
import { deepClone } from "../state/board";
import {
  createInitialTimeline,
  MAX_STRICT_REWIND_ENTRIES,
} from "../rules/rewind";
import { createStrictRandom, deriveStrictSeed } from "./rng";

/** JSON with object keys sorted, so hashes do not depend on construction order. */
export function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => (entry === undefined ? "null" : stableStringify(entry))).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return "null";
}

/** FNV-1a 32-bit hex; stable across Node/browser and independent of key insertion order. */
export function hashRoomState(room: Room): string {
  let hash = 0x811c9dc5;
  const text = stableStringify(room);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Hash the game state, not rewind presentation metadata: a repro starts from a clean snapshot, so
 * the `updatedAt` timestamp, the forward window/markers and the "Rewound"/"Forwarded" log rows
 * are excluded. Rules, board, hidden records, RNG position and action logs are all covered.
 */
export function canonicalRoomForRepro(room: Room): Room {
  const copy = deepClone(room);
  // Timestamps are presentation data for a repro; keep a constant so replay and export agree.
  copy.updatedAt = 0;
  delete copy.rewindStep;
  delete copy.botPause;
  delete copy.forwardablePlayerIds;
  delete copy.forwardAvailableUntil;
  delete copy.rewindConfirmation;
  copy.log = copy.log
    .filter((entry) => entry.actionKind !== "rewind" && entry.actionKind !== "forward")
    .map((entry, index) => ({ ...entry, id: `log_${index}` }));
  return copy;
}

export function hashCanonicalRoom(room: Room): string {
  return hashRoomState(canonicalRoomForRepro(room));
}

export interface CreateReproOptions {
  exportedAt?: number;
}

/**
 * Build a repro from the live branch of a timeline. Entries after the cursor are a forward
 * branch and are excluded. When the bounded history has pruned its start, `initial` is the
 * earliest retained snapshot and `truncated` is true.
 */
export function createStrictRepro(
  room: Room,
  timeline: EngineTimeline,
  options: CreateReproOptions = {},
): StrictReproFile {
  const live = timeline.entries.slice(0, Math.max(0, Math.min(timeline.cursor, timeline.entries.length)));
  const initial = deepClone(live[0]?.before ?? room);
  const actions: StrictReproAction[] = live.map((entry, index) => {
    const action =
      entry.action && typeof entry.action.type === "string"
        ? entry.action
        : { type: entry.actionType };
    return {
      index,
      at: entry.at,
      actorId: entry.actorId,
      action: deepClone(action) as Record<string, unknown> & { type: string },
    };
  });
  const stepHashes = actions.map((_action, index) => {
    const after = live[index + 1]?.before;
    return hashCanonicalRoom(after ? deepClone(after) : room);
  });
  return {
    format: STRICT_REPRO_FORMAT,
    version: STRICT_REPRO_VERSION,
    exportedAt: options.exportedAt ?? room.updatedAt ?? 0,
    roomCode: room.roomCode,
    rulesMode: room.rulesMode ?? "strict",
    roomMode: room.roomMode ?? "multiplayer",
    ...(typeof initial.rngSeed === "number" ? { gameSeed: initial.rngSeed } : {}),
    initial,
    initialHash: hashCanonicalRoom(initial),
    decklists: Object.fromEntries(
      room.players.map((player) => [player.id, player.decklistRaw ?? null]),
    ),
    actions,
    stepHashes,
    finalHash: hashCanonicalRoom(room),
    ...(typeof room.actionCount === "number" ? { finalActionCount: room.actionCount } : {}),
    ...(live.length > 0 && (live[0]?.seq ?? 0) > 0 ? { truncated: true } : {}),
  };
}

export interface ReplayFailure {
  step: number;
  reason: "invalid_repro" | "rejected" | "step_hash_mismatch" | "final_hash_mismatch";
  message: string;
  action?: StrictReproAction;
  expectedHash?: string;
  actualHash?: string;
}

export type ReplayResult =
  | {
      ok: true;
      room: Room;
      timeline: EngineTimeline;
      steps: number;
      hash: string;
    }
  | {
      ok: false;
      step: number;
      room: Room;
      timeline: EngineTimeline;
      steps: number;
      hash: string;
      failure: ReplayFailure;
    };

function invalidRepro(message: string): ReplayResult {
  const room = {
    roomCode: "",
    createdAt: 0,
    updatedAt: 0,
    phase: "lobby",
    players: [],
    log: [],
    chainEntries: [],
    chainResolveVotes: [],
  } as Room;
  return {
    ok: false,
    step: -1,
    room,
    timeline: createInitialTimeline(),
    steps: 0,
    hash: hashRoomState(room),
    failure: { step: -1, reason: "invalid_repro", message },
  };
}

/**
 * Replay a repro (optionally only the first `step` actions, for interactive import). Each action
 * is applied through the real `applyGameAction`; a rejection or a step/final hash mismatch stops
 * at the first divergent step.
 */
export function replayStrictRepro(file: StrictReproFile, step?: number): ReplayResult {
  if (!file || file.format !== STRICT_REPRO_FORMAT || file.version !== STRICT_REPRO_VERSION) {
    return invalidRepro("Not a version-1 rift-strict-repro file.");
  }
  if (!file.initial || !Array.isArray(file.actions)) {
    return invalidRepro("The repro is missing its initial room or action list.");
  }
  const limit = Math.max(
    0,
    Math.min(step === undefined ? file.actions.length : Math.trunc(step), file.actions.length),
  );
  let room = deepClone(file.initial);
  if (room.rulesMode !== "strict") room.rulesMode = "strict";
  if (typeof room.rngSeed !== "number") {
    room.rngSeed = file.gameSeed ?? deriveStrictSeed(room.roomCode, room.createdAt);
  }
  if (typeof room.rngCursor !== "number") room.rngCursor = 0;
  let timeline = createInitialTimeline();
  const mode = (file.roomMode ?? room.roomMode ?? "multiplayer") as ActionContext["mode"];

  for (let index = 0; index < limit; index += 1) {
    const entry = file.actions[index]!;
    const action = entry.action;
    if (!action || typeof action.type !== "string") {
      return {
        ok: false,
        step: index,
        room,
        timeline,
        steps: index,
        hash: hashRoomState(room),
        failure: {
          step: index,
          reason: "invalid_repro",
          message: `Action ${index} has no type.`,
          action: entry,
        },
      };
    }
    const result = applyGameAction(room, entry.actorId, action, {
      now: entry.at,
      rng: createStrictRandom(room.rngSeed ?? 0, room.rngCursor ?? 0).rng,
      mode,
      timeline,
    });
    if (!result.ok) {
      return {
        ok: false,
        step: index,
        room,
        timeline,
        steps: index,
        hash: hashRoomState(room),
        failure: {
          step: index,
          reason: "rejected",
          message: `${action.type} by ${entry.actorId}: ${result.error}`,
          action: entry,
          actualHash: hashRoomState(room),
        },
      };
    }
    room = result.state;
    if (result.timeline) timeline = result.timeline;
    const expected = file.stepHashes?.[index];
    if (expected) {
      const actual = hashCanonicalRoom(room);
      if (actual !== expected) {
        return {
          ok: false,
          step: index,
          room,
          timeline,
          steps: index + 1,
          hash: actual,
          failure: {
            step: index,
            reason: "step_hash_mismatch",
            message: `Step ${index} (${action.type} by ${entry.actorId}) diverged.`,
            action: entry,
            expectedHash: expected,
            actualHash: actual,
          },
        };
      }
    }
  }

  const hash = hashCanonicalRoom(room);
  // A partial replay is an import checkpoint, not a reproduction claim.
  if (step === undefined && hash !== file.finalHash) {
    return {
      ok: false,
      step: limit,
      room,
      timeline,
      steps: limit,
      hash,
      failure: {
        step: limit,
        reason: "final_hash_mismatch",
        message: `Final hash ${hash} does not match ${file.finalHash}.`,
        expectedHash: file.finalHash,
        actualHash: hash,
      },
    };
  }
  return { ok: true, room, timeline, steps: limit, hash };
}

/** Rebuild the timeline entries for an imported prefix so rewind keeps working in the new room. */
export function reproTimelineForStep(file: StrictReproFile, step?: number): EngineTimeline {
  const replay = replayStrictRepro(file, step);
  if (!replay.ok) return replay.timeline;
  return replay.timeline;
}

export { MAX_STRICT_REWIND_ENTRIES };
