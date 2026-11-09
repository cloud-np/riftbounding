/**
 * Flow — rules 829.1.a, 829.1.b, 829.1.b.1, 829.1.b.2, 829.1.c.1–829.1.c.3, 829.2.
 *
 * "[Flow] [Cost]" on a spell is short for "You may play this from your trash for its flow cost.
 * Then banish it." (829.1.b):
 *
 * - permission: a spell in its owner's trash may be played for its Flow cost, an alternate cost
 *   that replaces the base cost (829.1.c.1, 356.1.a); timing and every other permission are
 *   unchanged (829.1.b.2), so the spell's own [Action]/[Reaction] still decide when;
 * - 829.1.b.1: once finalized, if the spell would leave the chain other than by its own
 *   instructions, it is banished instead (`ChainItem.leaveChainTo = "banished"`, honoured by
 *   `pushSpellToTrash` and the `counter` op);
 * - the cost comes from the printed text (`[Flow][4][Fury]`); a spell granted [Flow] by an effect
 *   ("give a spell in your trash [Flow] equal to its cost this turn") uses its printed cost.
 *
 * Engine limit: 829.1.c.3 (several Flow instances with different costs) uses the first printed
 * cost — a play permission carries one alternate cost.
 */
import type { Cost, Room } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import { durationActive } from "../layers/durations";
import { parseFlowCosts } from "./cost-text";
import type { PlayPermission } from "./permissions";

/** 829.1.c: the Flow costs a card has (printed, then granted). Empty for non-spells. */
export function flowCosts(room: Room, host: RulesHost, cardId: string): Cost[] {
  const info = host.cardInfo(room, cardId);
  if (!info || !(info.type ?? "").toLowerCase().includes("spell")) return [];
  const out = parseFlowCosts(info.text);
  const grants = room.rules?.objects[cardId]?.keywordGrants ?? [];
  const granted = grants.some(
    (grant) => !grant.removed && grant.keyword.toLowerCase() === "flow" && durationActive(room, grant),
  );
  const removed = grants.some(
    (grant) => grant.removed && grant.keyword.toLowerCase() === "flow" && durationActive(room, grant),
  );
  if (removed) return [];
  if (granted) {
    const power = typeof info.powerCost === "number" ? Math.max(0, Math.trunc(info.powerCost)) : 0;
    out.push({
      energy: typeof info.energyCost === "number" ? Math.max(0, Math.trunc(info.energyCost)) : 0,
      ...(power > 0 ? { additional: { "power:self": power } } : {}),
    });
  }
  return out;
}

/** 829.1.b: permission to play a Flow spell from its owner's trash, for its Flow cost. */
export function flowPermission(room: Room, host: RulesHost, playerId: string, located: LocatedCard): PlayPermission | null {
  if (located.zone !== "trash" || located.playerId !== playerId) return null;
  const [cost] = flowCosts(room, host, located.card.id);
  if (!cost) return null;
  return { id: "flow", rule: "829.1.b", cost };
}
