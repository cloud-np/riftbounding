/**
 * Projection of `RulesState` back onto the fields today's board renders — rules 349–355.
 *
 * The sandbox `chain_add` (`packages/engine/src/actions/chain.ts`) stores the entry id on both
 * the entry and the displayed card, keeping the physical card id in `sourceCardId`; we mirror
 * that shape exactly so the existing board UI and the strict chain agree.
 */
import type { CardInstance, ChainEntry, ChainItem, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { projectPools } from "./pools";

function chainEntryFor(room: Room, item: ChainItem, host: RulesHost): ChainEntry {
  const snapshot = item.cardSnapshot;
  const physicalCardId = snapshot?.id ?? item.sourceObjectId ?? item.id;
  const card: CardInstance = snapshot
    ? { ...snapshot, id: item.id, exhausted: false }
    : {
        id: item.id,
        name: item.cardName ?? item.abilityRef ?? "Ability",
        source: "mainDeck",
        exhausted: false,
        createdAt: item.addedAt ?? 0,
        type: "Card",
      };
  return {
    id: item.id,
    card,
    addedAt: item.addedAt ?? room.updatedAt,
    fromZone: (item.fromZone ?? "hand") as ChainEntry["fromZone"],
    sourceCardId: physicalCardId,
    byPlayerId: item.controller,
    byPlayerName: host.playerName(room, item.controller),
  };
}

/**
 * Project strict state onto the fields today's board renders:
 * `activeTurnPlayerId`, `activeTurnStep`, `turnNumber`, `chainEntries` (newest first),
 * rune pools (`floatingEnergy`/`floatingPower`), and the scored-this-turn display map.
 */
export function projectRules(room: Room, host: RulesHost): void {
  const rules = room.rules;
  if (!rules) return;

  // 304/314: the turn player and the coarse UI step.
  room.turnNumber = rules.turn.number;
  room.activeTurnPlayerId = rules.turn.player;
  room.activeTurnStep = rules.turn.phase === "main" ? "main" : "beginning";

  // 349–355 display projection: Room.chainEntries is newest first.
  room.chainEntries = [...rules.chain].reverse().map((item) => chainEntryFor(room, item, host));
  room.chainResolveVotes = [];
  // Strict mode owns showdowns; never let the sandbox assist machine leak in.
  room.pendingBattlefieldConquerAssist = undefined;

  // 165: mirror Rune Pools onto the sandbox floating-resource display.
  projectPools(room, rules);
}
