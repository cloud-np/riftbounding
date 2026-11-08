/** Play card / play location verdicts — rules 349–359, 420.1.a. */
import type { Room } from "@rift/protocol";
import type { CardInfo, LocatedCard, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { fail } from "../types";
import { cardTimingVerdict } from "./timing";

export interface PlayCardVerdictOk {
  ok: true;
  located: LocatedCard;
  info: CardInfo | null;
  /** 355.2/359.2.d: the normalized destination ("base" when absent). */
  location: string;
}

export type PlayCardVerdict = PlayCardVerdictOk | RulesFailure;

/**
 * 355.2/355.2.a/358.5/359.2.d: choose a valid Location before any mutation. Units may enter the
 * controller's Base or a Battlefield the controller controls; Non-Unit Gear always enters at
 * the Base. An invalid location cancels the play (358.5), never silently falls back to Base.
 */
export function playLocationVerdict(
  room: Room,
  playerId: string,
  info: CardInfo | null,
  requested: unknown,
  host: RulesHost,
): { ok: true; location: string } | RulesFailure {
  if (requested !== undefined && typeof requested !== "string") {
    return fail("invalid_location", "355.2");
  }
  const type = (info?.type ?? "").toLowerCase();
  const isUnit = type.includes("unit");
  const isGear = type.includes("gear");
  const location = requested ?? "base";

  if (!isUnit) {
    // 359.2.d: Non-Unit Gear enters Ready at the player's Base.
    if (isGear && location !== "base") return fail("invalid_location", "359.2.d");
    return { ok: true, location: "base" };
  }

  if (location === "base") return { ok: true, location };
  const battlefields = host.battlefieldZones(room);
  if (!battlefields.includes(location as (typeof battlefields)[number])) {
    return fail("invalid_location", "355.2.a");
  }
  // 355.2.a: a Battlefield is only valid when the controller controls it.
  if (!host.hasUnitAt(room, playerId, location)) {
    return fail("invalid_location", "355.2.a");
  }
  return { ok: true, location };
}

/** 420.1.a + timing + 355.2: the single play verdict used by both the view and the write path. */
export function playCardVerdict(
  room: Room,
  playerId: string,
  cardId: string,
  host: RulesHost,
  location?: unknown,
): PlayCardVerdict {
  const located = host.findCard(room, cardId);
  if (
    !located ||
    located.playerId !== playerId ||
    (located.zone !== "hand" && located.zone !== "champion")
  ) {
    return fail("not_in_hand", "420.1.a");
  }
  const info = host.cardInfo(room, cardId);
  const timing = cardTimingVerdict(room, playerId, info);
  if (!timing.ok) return timing;
  const place = playLocationVerdict(room, playerId, info, location, host);
  if (!place.ok) return place;
  return { ok: true, located, info, location: place.location };
}
