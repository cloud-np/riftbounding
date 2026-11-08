/**
 * Shared helpers for effect ops (§6.2). Ops mutate only the draft room and emit a `GameEvent`
 * for every change; game actions go through the `actions/*` primitives so replacement
 * interceptors (367–375) fire.
 */
import type { Amount, PlayerSelector, Room } from "@rift/protocol";
import type { RulesHost } from "../../host";
import type { EffectExecutionContext } from "../execute";
import type { EvalContext } from "../env";
import { evaluateAmount, resolvePlayers } from "../evaluate";
import { evalContextOf } from "../targets";
import { boardZoneList, locate } from "../objects";

export function ctxOf(context: EffectExecutionContext): EvalContext {
  return evalContextOf(context);
}

/** Integer amount, `null` when the information is unavailable (359.3.e.12). */
export function amountOf(context: EffectExecutionContext, amount: Amount | undefined): number | null {
  const value = evaluateAmount(ctxOf(context), amount);
  return value === null ? null : Math.trunc(value);
}

export function playersOf(context: EffectExecutionContext, selector: PlayerSelector | undefined): string[] {
  return resolvePlayers(ctxOf(context), selector);
}

export function hostOf(context: EffectExecutionContext): RulesHost {
  return context.step.host;
}

export function isOnBoard(room: Room, host: RulesHost, id: string): boolean {
  const located = locate(room, host, id);
  return !!located && boardZoneList(room, host).includes(located.zone);
}

/**
 * 705 / 748 / 186.1: an object that leaves the board loses its rules state (buffs, counters,
 * statuses); a token put into a non-board zone ceases to exist.
 */
export function forgetObject(room: Room, host: RulesHost, id: string): void {
  if (room.rules) delete room.rules.objects[id];
  const located = locate(room, host, id);
  if (located && located.card.source === "token" && !boardZoneList(room, host).includes(located.zone)) {
    host.takeCard(room, located.playerId, located.zone, id);
  }
}
