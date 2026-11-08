/**
 * Payment — rules 165, 356, 403+.
 *
 * Owner: R2-play. Consumer: R2-effects (the `pay` op and "you may pay …" costs).
 * Semantics: `canPayCost` answers whether `playerId` can pay `cost` now from the rune pool plus
 * rune/resource abilities (165, 403+). `payCost` pays with an automatic plan (or `opts.plan`)
 * and mutates only the given draft; it returns a Verdict (`ok`, or `insufficient_resources`
 * with rule "356"/"165").
 *
 * Stub semantics: an empty cost (no energy, power, exhaust/discard/kill/points/xp/additional)
 * is payable; anything else is insufficient for now.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Cost, Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import type { RulesStepContext } from "../types";

function isEmptyCost(cost: Cost): boolean {
  if (cost.energy !== undefined) return false;
  if (cost.power && Object.keys(cost.power).length > 0) return false;
  if (cost.exhaust !== undefined) return false;
  if (cost.discard !== undefined) return false;
  if (cost.kill !== undefined) return false;
  if (cost.payPoints !== undefined) return false;
  if (cost.spendXp !== undefined) return false;
  if (cost.additional && Object.keys(cost.additional).length > 0) return false;
  return true;
}

export function canPayCost(
  room: Room,
  host: RulesHost,
  playerId: string,
  cost: Cost,
  opts?: { sourceObjectId?: string },
): boolean {
  // Stub (R2-play): only an empty cost is payable until the real planner lands.
  void room;
  void host;
  void playerId;
  void opts;
  return isEmptyCost(cost);
}

export function payCost(
  room: Room,
  step: RulesStepContext,
  playerId: string,
  cost: Cost,
  opts?: { plan?: unknown; sourceObjectId?: string },
): Verdict {
  // Stub (R2-play): no mutation; non-empty costs reject with 356 until the planner lands.
  void room;
  void step;
  void playerId;
  void opts;
  if (isEmptyCost(cost)) return { ok: true };
  return { ok: false, code: "insufficient_resources", rule: "356" };
}
