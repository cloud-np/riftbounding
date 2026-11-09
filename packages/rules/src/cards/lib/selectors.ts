/**
 * Shared selectors and zone references for card scripts.
 */
import type { Selector, ZoneSelector } from "@rift/protocol";

/** The ability's source object (`targetRef: "self"`). */
export const SELF: Selector = { targetRef: "self" };

/** The current event's subject. */
export const EVENT_SUBJECT: Selector = { targetRef: "event" };

/** The attached card's host (718.3 effect text of an attached card). */
export const HOST: Selector = { targetRef: "host" };

/** The battlefield the source is at ("here"). */
export const HERE: ZoneSelector = { kind: "chosen", ref: "here" };

/** A chosen unit with extra filters (355.7 target). */
export function aUnit(extra: Partial<Selector> = {}): Selector {
  return { chosen: true, cardType: "unit", ...extra };
}
