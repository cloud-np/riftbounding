/** Standard Move verdict — rules 144, 449–455. */
import type { BattlefieldZone, Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../host";
import { fail } from "../types";
import { chainExists, isTurnPlayer, showdownActive } from "../state/turn";
import { baseActionVerdict } from "./timing";
import { restrictionFor } from "../layers/restrictions";
import { cardKeywords, hasKeyword } from "../play/keywords";
import { playersWithUnitsAt } from "../play/control";
import { combatBarsDestination } from "../combat/begin";

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
  // 144.1.a: a Standard Move can be performed during the player's Main Phase. Keep the
  // move-specific citation (the shared gate cites 316 for every intent).
  if (!base.ok) return base.code === "not_main_phase" ? fail("not_main_phase", "144.1.a") : base;
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
    // 107.3.e / 811: a facedown card is in a Facedown Zone, not a Unit at a location.
    if (located.card.hidden) return fail("unit_not_found", "107.3.e", `${unitId} is facedown`);
    if (located.playerId !== playerId) return fail("illegal_target", "144.4");
    if (host.isExhausted(room, unitId)) return fail("unit_exhausted", "144.2", unitId);
    // 144.4 / 449.2: the destination must differ from the Unit's current location.
    if (located.zone === to) return fail("invalid_location", "144.4", unitId);
    // 144.4: Base → Battlefield; Battlefield → Base; only Ganking goes Battlefield → Battlefield.
    const fromBattlefield = destinations.includes(located.zone as (typeof destinations)[number]);
    const toBattlefield = to !== "base";
    // 810.1.b / 810.3: Ganking (printed or granted, 475–479) is the only Battlefield → Battlefield path.
    if (fromBattlefield && toBattlefield && !hasKeyword(cardKeywords(room, host, unitId, info), "Ganking")) {
      return fail("invalid_location", "144.4.c", unitId);
    }
    // 475–479 restriction layer ("Units can't move from here to base", …).
    const restriction = restrictionFor(room, host, { kind: "move", playerId, objectId: unitId, to });
    if (restriction) return fail("restricted", restriction.rule ?? "421", restriction.note ?? unitId);
  }
  if (to !== "base") {
    // 449.2 / 451.2 / 144.4.a.1: not into a battlefield with Units of 2 players that aren't the
    // mover (facedown cards are not Units present, 107.3).
    const others = playersWithUnitsAt(room, host, to).filter((id) => id !== playerId);
    if (others.length >= 2) return fail("invalid_location", "449.2");
    // 449.2.a / 464.1: with 3+ players, a battlefield with a Staged Combat (an ongoing Combat
    // already forbids Standard Moves, 144.1.c) is invalid for a player not involved in it or
    // without Units there. R2-combat's helper owns who is involved (466.2.c).
    if (combatBarsDestination(room, playerId, to as BattlefieldZone, "move", host)) {
      return fail("invalid_location", "449.2.a");
    }
  }
  return { ok: true };
}
