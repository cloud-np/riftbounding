/** Standard Move verdict — rules 144, 449–455. */
import type { Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import { fail } from "../types";
import { chainExists, isTurnPlayer, showdownActive } from "../state/turn";
import { baseActionVerdict } from "./timing";

export interface MoveVerdictContext {
  host: RulesHost;
}

/** 144/450–455: Standard Move timing + destination restrictions. */
export function moveTimingVerdict(
  room: Room,
  playerId: string,
  unitIds: string[],
  to: string,
  host: RulesHost,
): Verdict {
  const base = baseActionVerdict(room, playerId);
  if (!base.ok) return base;
  const rules = room.rules!;
  if (!isTurnPlayer(room, playerId)) return fail("not_your_turn", "410");
  // 144.1.b/c: not during a Closed State, Showdown or Combat. A Closed State is not a
  // "Reaction required" window for Moves (that code belongs to cards/abilities, 309.1.a).
  if (chainExists(room)) return fail("chain_not_empty", "144.1.b");
  if (showdownActive(room)) return fail("showdown_active", "144.1.c");
  if (rules.combat) return fail("combat_active", "144.1.c");
  if (unitIds.length === 0) return fail("unit_not_found", "144");
  // NEW-1: duplicate ids would exhaust/move the same Unit twice; reject the payload.
  if (new Set(unitIds).size !== unitIds.length) return fail("illegal_action", "144", "duplicate unit ids");

  const destinations = host.battlefieldZones(room);
  const boardZones: string[] = ["base", ...destinations];
  if (to !== "base" && !destinations.includes(to as (typeof destinations)[number])) {
    return fail("invalid_location", "449.2");
  }
  for (const unitId of unitIds) {
    const located = host.findCard(room, unitId);
    if (!located) return fail("unit_not_found", "144", unitId);
    // NEW-1 (144.1 / 144.4 / 449.2): a Standard Move is performed by a Unit already on the
    // Board. Hand, deck, trash, champion and banished sources are card-play/effect territory
    // (349–359, 429), never 449; accepting them was a free deployment cheat.
    if (!boardZones.includes(located.zone)) {
      return fail("unit_not_found", "144", `${unitId} is not on the board (${located.zone})`);
    }
    const info = host.cardInfo(room, unitId);
    if (!info?.type.toLowerCase().includes("unit")) return fail("unit_not_found", "144", unitId);
    if (located.playerId !== playerId) return fail("illegal_target", "144.4");
    if (host.isExhausted(room, unitId)) return fail("unit_exhausted", "144.2", unitId);
    // 144.4 / 449.2: the destination must differ from the Unit's current location.
    if (located.zone === to) return fail("invalid_location", "144.4", unitId);
    // 144.4: Base → Battlefield; Battlefield → Base; only Ganking goes Battlefield → Battlefield.
    const fromBattlefield = destinations.includes(located.zone as (typeof destinations)[number]);
    const toBattlefield = to !== "base";
    if (fromBattlefield && toBattlefield && !info.keywords.some((keyword) => keyword.toLowerCase() === "ganking")) {
      // The only Battlefield → Battlefield path is Ganking (144.4.c).
      return fail("invalid_location", "144.4.c", unitId);
    }
  }
  if (to !== "base") {
    // 449.2 / 144.4.a.1: not into a battlefield with Units of 2 players that aren't the mover.
    const others = host
      .activePlayerIds(room)
      .filter((id) => id !== playerId && host.hasUnitAt(room, id, to));
    if (others.length >= 2) return fail("invalid_location", "449.2");
  }
  return { ok: true };
}
