/**
 * Heavy differential fuzz against the original minified transition engine.
 *
 * - Every action type executable by the original bundle is covered: the whole optimistic set
 *   `cV` (65), the five `cU`-only handlers and the four coordination-arrow actions (70 total).
 * - Payloads are generated from the live state (see `helpers/oracle-fuzz-actions.ts`).
 * - Each seed starts with a deterministic permutation of all 70 types so coverage is guaranteed
 *   independently of random luck, then continues with uniform random types.
 * - Compared for four fixtures: duel, free_for_all_3, free_for_all_4, teams_2v2.
 *
 * Default CI run: 10 seeds × 200 actions per variant. Override with the env vars:
 *
 *   RIFT_FUZZ_SEEDS=50 RIFT_FUZZ_STEPS=300 pnpm --filter @rift/engine test
 *
 * `rewind_last_action` / `forward_last_rewind` / `respond_rewind_confirmation` are server-only
 * actions (absent from `cU`; the bundle answers them with an authoritative snapshot). The fuzz
 * therefore verifies they are rejected exactly when the original rejects them, and the dedicated
 * `rewind fuzz` test below exercises the full timeline behaviour against captured snapshots.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { EngineTimeline, Room } from "@rift/protocol";
import { applyGameAction, createInitialTimeline } from "../src";
import {
  buildFuzzAction,
  oracleActionTypes,
  shuffled,
  type FuzzAction,
} from "./helpers/oracle-fuzz-actions";
import {
  buildFuzzFixture,
  FUZZ_VARIANTS,
  type FuzzVariant,
} from "./helpers/oracle-fuzz-fixtures";

const ROOT = path.resolve(__dirname, "../../..");
const ORACLE = path.join(ROOT, ".recon/oracle/load.mjs");
const ORACLE_DIR = path.join(ROOT, ".recon/oracle");
const DECKS = path.join(ORACLE_DIR, "fixtures/decks.json");
const CHUNKS = path.join(ROOT, ".recon/site/playapp/dl/_next/static/immutable/chunks");
const HAS_ORACLE = fs.existsSync(ORACLE) && fs.existsSync(DECKS) && fs.existsSync(CHUNKS);

const SEEDS = Math.max(1, Number(process.env.RIFT_FUZZ_SEEDS ?? 10));
const STEPS = Math.max(1, Number(process.env.RIFT_FUZZ_STEPS ?? 200));
const BASE_TIME = 1760000000000;
const BASE_SEED = 20261022;
const ACTIVE_VARIANTS = process.env.RIFT_FUZZ_VARIANTS
  ? FUZZ_VARIANTS.filter((variant) =>
      (process.env.RIFT_FUZZ_VARIANTS ?? "")
        .split(",")
        .map((value) => value.trim())
        .includes(variant),
    )
  : FUZZ_VARIANTS;

/** Minimal justified normalisations; everything else is compared byte-for-byte. */
function normalize(room: Room, variant: FuzzVariant): unknown {
  const copy = JSON.parse(JSON.stringify(room)) as Record<string, unknown>;
  // 1. Server-owned wall clock. `cY`/`cU` never advance it; our transition sets ctx.now.
  delete copy.updatedAt;
  // 2. Logs are server-owned: the original handlers emit none (text lives in game-log-en.json).
  delete copy.log;
  // 3. Rewind bookkeeping is a separate server document (protocol v5). The original room is the
  //    client projection and has no rewind fields; ours mirrors the rewind confirmation for
  //    local/offline use. EngineTimeline itself never lives on Room.
  delete copy.rewindProtocolVersion;
  delete copy.rewindablePlayerIds;
  delete copy.forwardablePlayerIds;
  delete copy.forwardAvailableUntil;
  delete copy.rewindConfirmation;
  // 4. Duel victory detection: the original *client mirror* `dq.S` skips the score check for
  //    duel (`if (p(e)) return`) because the authoritative server owns duel outcomes; this port
  //    applies the strict-lead check to every variant (PORTING.md deviation #1). FFA/2v2
  //    gameOutcome is compared exactly.
  if (variant === "duel") delete copy.gameOutcome;
  return copy;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (1664525 * state + 0x3c6ef35f) >>> 0;
    return state / 0x100000000;
  };
}

/** cY's id factory shape, reset per action. */
function optimisticFactory(intentId: number): (kind: string) => string {
  let n = 0;
  return (kind: string) => `${kind}_q${intentId}_${n++}`;
}

interface Coverage {
  attempts: number;
  changed: number;
  noop: number;
  rejected: number;
}

type CoverageTable = Record<FuzzVariant, Map<string, Coverage>>;

function coverageFor(table: CoverageTable, variant: FuzzVariant): Map<string, Coverage> {
  let map = table[variant];
  if (!map) {
    map = new Map();
    table[variant] = map;
  }
  return map;
}

function record(
  table: CoverageTable,
  variant: FuzzVariant,
  type: string,
  changed: boolean,
  rejected: boolean,
): void {
  const map = coverageFor(table, variant);
  const entry = map.get(type) ?? { attempts: 0, changed: 0, noop: 0, rejected: 0 };
  entry.attempts += 1;
  if (rejected) entry.rejected += 1;
  else if (changed) entry.changed += 1;
  else entry.noop += 1;
  map.set(type, entry);
}

function printCoverage(table: CoverageTable, types: string[], variants: FuzzVariant[]): void {
  const header = ["action", ...variants.map((variant) => variant)].join("\t");
  const lines = [header];
  for (const type of types) {
    const row = [type];
    for (const variant of variants) {
      const entry = table[variant].get(type);
      row.push(
        entry
          ? `${entry.attempts} (${entry.changed}c/${entry.noop}n/${entry.rejected}r)`
          : "0",
      );
    }
    lines.push(row.join("\t"));
  }
  // eslint-disable-next-line no-console
  console.log(`\n[fuzz coverage] seeds=${SEEDS} steps=${STEPS}\n${lines.join("\n")}`);
}

type OracleAction = FuzzAction;

interface OracleModule {
  loadOriginal: () => {
    applyAction: (
      state: Room,
      actorId: string,
      action: OracleAction,
      opts?: Record<string, unknown>,
    ) => { ok: boolean; state: Room; error?: string };
    raw: { cU: Record<string, unknown>; cV: Set<string> };
    runtime: { loadModule: (id: number) => { exports: unknown } };
  };
  toPlain: <T>(value: T) => T;
  diffStates: (left: unknown, right: unknown, basePath?: string) => Array<{ path: string; left: unknown; right: unknown }>;
}

describe.skipIf(!HAS_ORACLE)(`oracle deep fuzz (${SEEDS} seeds × ${STEPS} actions)`, () => {
  it("matches the original for duel and every multiplayer variant", async () => {
    const oracleModule = (await import(pathToFileURL(ORACLE).href)) as OracleModule;
    const { loadOriginal, toPlain, diffStates } = oracleModule;
    const original = loadOriginal();
    const types = oracleActionTypes(original);
    const coverage: CoverageTable = {
      duel: new Map(),
      free_for_all_3: new Map(),
      free_for_all_4: new Map(),
      teams_2v2: new Map(),
    };
    const minAttempts = Math.min(SEEDS, 10);

    for (const variant of ACTIVE_VARIANTS) {
      const base = buildFuzzFixture(original as never, variant);
      for (let seedIndex = 0; seedIndex < SEEDS; seedIndex += 1) {
        const seed = (BASE_SEED + seedIndex * 7919 + variant.length * 104729) >>> 0;
        const random = lcg(seed);
        let mine = JSON.parse(JSON.stringify(base)) as Room;
        let theirs = JSON.parse(JSON.stringify(base)) as Room;
        let mineNormalized = JSON.stringify(normalize(mine, variant));
        let theirsNormalized = JSON.stringify(normalize(theirs, variant));
        const required = shuffled(types, random);

        for (let step = 0; step < STEPS; step += 1) {
          const type = step < required.length ? required[step]! : types[Math.floor(random() * types.length)]!;
          const planned = buildFuzzAction(type, mine, random);
          const actor = mine.players.some((player) => player.id === planned.actor)
            ? planned.actor
            : (mine.activeTurnPlayerId ?? mine.players[0]!.id);
          const action = planned.action;
          const now = BASE_TIME + 100_000 + seedIndex * 1_000_000 + step * 1000;
          const intentId = ((seed * 2654435761 + step * 2246822519 + 1) >>> 0) || 1;

          const mineResult = applyGameAction(mine, actor, action, {
            now,
            rng: lcg(intentId),
            mode: "multiplayer",
            idFactory: optimisticFactory(intentId),
          });
          const oracleResult = original.applyAction(theirs, actor, action, {
            intentId,
            enqueuedAt: now,
            now: () => now,
            random: lcg(intentId),
            idFactory: optimisticFactory(intentId),
            autoObserved: false,
          });
          // `.recon/oracle/load.mjs` applyDirect() calls its settle helper with the *post-action*
          // room as both previousRoom and nextRoom, so `dq.z` is always false and `dq.S` is
          // skipped for the five cU-only actions. The real pipeline (cY in the bundle, and the
          // authoritative server) runs `dq.z → dq.S → cx.h` after every changed handler. Apply
          // the missing step here so the oracle reflects the original transition function.
          let oracleState = oracleResult.state;
          if (!original.raw.cV.has(type) && oracleState !== theirs) {
            const z = (
              original.runtime.loadModule(357603) as {
                exports: { z: (input: unknown) => boolean };
              }
            ).exports.z({ previousRoom: theirs, nextRoom: oracleState, action });
            if (z) {
              oracleState = (
                original.runtime.loadModule(357603) as {
                  exports: { S: (room: Room) => Room };
                }
              ).exports.S(oracleState);
              oracleState = (
                original.runtime.loadModule(487939) as {
                  exports: { h: (room: Room) => Room };
                }
              ).exports.h(oracleState);
            }
          }

          const mineState = mineResult.ok ? mineResult.state : mine;
          const mineStateNormalized = mineResult.ok
            ? JSON.stringify(normalize(mineState, variant))
            : mineNormalized;
          const oracleStateNormalized = JSON.stringify(normalize(oracleState, variant));
          const mineChanged = mineStateNormalized !== mineNormalized;
          const oracleChanged = oracleStateNormalized !== theirsNormalized;

          record(coverage, variant, type, mineChanged, !mineResult.ok);

          const label = `${variant} seed=${seed} step=${step} actor=${actor} type=${type}`;
          expect(
            oracleChanged,
            `${label}: original ${oracleChanged ? "changed" : "did not change"} but ours ${
              mineResult.ok ? (mineChanged ? "changed" : "did not change") : `rejected (${mineResult.error})`
            }`,
          ).toBe(mineChanged);
          if (!mineResult.ok) {
            expect(
              oracleStateNormalized,
              `${label}: we rejected (${mineResult.error}) but the original changed state`,
            ).toBe(theirsNormalized);
            theirs = oracleState;
            theirsNormalized = oracleStateNormalized;
            continue;
          }

          if (mineStateNormalized !== oracleStateNormalized) {
            const differences = diffStates(
              toPlain(JSON.parse(mineStateNormalized) as unknown),
              toPlain(JSON.parse(oracleStateNormalized) as unknown),
            );
            expect(differences.slice(0, 10), `${label}: state mismatch`).toEqual([]);
          }
          mine = mineState;
          mineNormalized = mineStateNormalized;
          theirs = oracleState;
          theirsNormalized = oracleStateNormalized;
        }
      }
    }

    printCoverage(coverage, types, ACTIVE_VARIANTS);
    for (const variant of ACTIVE_VARIANTS) {
      for (const type of types) {
        const attempts = coverage[variant].get(type)?.attempts ?? 0;
        expect(
          attempts,
          `${type} was only attempted ${attempts}× in ${variant} (expected ≥ ${minAttempts})`,
        ).toBeGreaterThanOrEqual(minAttempts);
      }
    }
  }, 0);

  it("rewind/forward restore exact snapshots from the serializable timeline", async () => {
    const { loadOriginal } = (await import(pathToFileURL(ORACLE).href)) as OracleModule;
    const original = loadOriginal();
    let room = buildFuzzFixture(original as never, "duel");
    let timeline: EngineTimeline = createInitialTimeline();
    const snapshots: Array<{ type: string; actor: string; before: Room }> = [];
    const tracked = (actor: string, action: FuzzAction, now: number) => {
      snapshots.push({ type: action.type, actor, before: JSON.parse(JSON.stringify(room)) });
      const result = applyGameAction(room, actor, action, {
        now,
        rng: lcg(now),
        mode: "multiplayer",
        idFactory: optimisticFactory(now),
        timeline,
      });
      if (!result.ok) throw new Error(`${action.type}: ${result.error}`);
      // Simulate a Durable Object eviction between every single action.
      timeline = JSON.parse(JSON.stringify(result.timeline)) as EngineTimeline;
      room = JSON.parse(JSON.stringify(result.state)) as Room;
      expect("timeline" in room).toBe(false);
    };

    tracked("p1", { type: "draw_cards", count: 2 }, 10);
    tracked("p1", { type: "adjust_score", delta: 1 }, 20);
    tracked("p2", { type: "adjust_score", delta: 1 }, 30);
    tracked("p1", { type: "adjust_legend_xp", delta: 2 }, 40);
    tracked("p2", { type: "draw_rune" }, 50);

    const p1BeforeLegendXp = snapshots.find(
      (snapshot, index) => snapshot.actor === "p1" && index === 3,
    )!;
    const beforeRewind = JSON.parse(JSON.stringify(room)) as Room;

    // p1's last meaningful action is adjust_legend_xp; p2 acted afterwards ⇒ approval required.
    const request = applyGameAction(room, "p1", { type: "rewind_last_action" }, {
      now: 60,
      rng: lcg(60),
      mode: "multiplayer",
      timeline,
    });
    expect(request.ok).toBe(true);
    if (!request.ok) return;
    timeline = JSON.parse(JSON.stringify(request.timeline)) as EngineTimeline;
    room = request.state;
    expect(room.rewindConfirmation?.requesterPlayerId).toBe("p1");
    const requestId = room.rewindConfirmation!.requestId;

    const approve = applyGameAction(room, "p2", {
      type: "respond_rewind_confirmation",
      requestId,
      response: "approve",
    }, { now: 70, rng: lcg(70), mode: "multiplayer", timeline });
    expect(approve.ok).toBe(true);
    if (!approve.ok) return;
    timeline = JSON.parse(JSON.stringify(approve.timeline)) as EngineTimeline;
    room = approve.state;
    expect(JSON.stringify(normalize(room, "duel"))).toBe(
      JSON.stringify(normalize(p1BeforeLegendXp.before, "duel")),
    );

    const forward = applyGameAction(room, "p1", { type: "forward_last_rewind" }, {
      now: 80,
      rng: lcg(80),
      mode: "multiplayer",
      timeline,
    });
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    timeline = JSON.parse(JSON.stringify(forward.timeline)) as EngineTimeline;
    room = forward.state;
    expect(JSON.stringify(normalize(room, "duel"))).toBe(
      JSON.stringify(normalize(beforeRewind, "duel")),
    );
    expect(timeline.forward).toBeUndefined();
  }, 0);
});
