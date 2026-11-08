/**
 * Internal step context shared by every strict-rules helper.
 *
 * Nothing here is stored in `Room`; events are collected per intent and returned to the engine.
 */
import type { GameEvent, ReasonCode, RuleRef, RulesState, Room, Verdict } from "@rift/protocol";
import type { RulesContext, RulesHost } from "./host";

export interface RulesStepContext {
  ctx: RulesContext;
  host: RulesHost;
  events: GameEvent[];
  /**
   * Set when a bounded loop (322 cleanup recursion, 317.2.f expiration repeat) hits its guard.
   * `advance` stops and `applyRulesIntent` returns `{ ok:false, code:"loop_guard", rule }`.
   */
  loopGuard?: { rule: RuleRef };
}

export type RulesFailure = Extract<Verdict, { ok: false }>;

export function pushEvent(events: GameEvent[], event: GameEvent): void {
  events.push(event);
}

export function rulesOf(room: Room): RulesState | null {
  return room.rulesMode === "strict" ? (room.rules ?? null) : null;
}

export function fail(code: ReasonCode, rule: RuleRef, detail?: string): RulesFailure {
  return { ok: false, code, rule, ...(detail ? { detail } : {}) };
}

export function log(
  step: RulesStepContext,
  room: Room,
  key: string,
  text: string,
  playerId?: string,
  actionKind: "turn" | "spell" | "board" | "battle" | "score" | "draw" | "resource" | "deck" | "trash" | "inspect" | "legend-xp" | "rewind" | "forward" = "turn",
  params?: Record<string, string | number | null | undefined>,
): void {
  step.host.appendLog(room, {
    key,
    text,
    ...(params ? { params } : {}),
    ...(playerId ? { playerId } : {}),
    actionKind,
  });
}

/** 143.2: effective Might lives in the layers module (R2-effects owns `layers/`). */
export { effectiveMight } from "./layers";
