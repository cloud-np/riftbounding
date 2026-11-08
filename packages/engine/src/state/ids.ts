/**
 * Deterministic id helpers.
 *
 * The original client/server id factories are `<kind>_<8 hex chars>`; the optimistic
 * client path uses `<kind>_q<actionId>_<n>`. Both are supported: pass `ctx.idFactory` for
 * exact reproduction, otherwise ids are derived from `ctx.rng`.
 */
import type { ActionContext } from "../types";

export function hex8(rng: () => number): string {
  return Math.floor(0xffffffff * rng())
    .toString(16)
    .padStart(8, "0");
}

export function makeIdFactory(ctx: ActionContext): (kind: string) => string {
  if (ctx.idFactory) return ctx.idFactory;
  return (kind: string) => `${kind}_${hex8(ctx.rng)}`;
}

/** Original client-card-id shape accepted from `clientCardId(s)` (437381 `f`). */
export const CLIENT_CARD_ID = /^card_c[0-9A-Za-z_-]{1,96}$/;

export function makeLogId(now: number, roomLogLength: number, index: number): string {
  return `log_${now.toString(36)}_${roomLogLength + index}`;
}

/** `sz()` setup card id suffix: lowercase slug of the card id/name. */
export function setupCardSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
