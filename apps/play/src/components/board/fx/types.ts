import type { BattlefieldZone, CardInstance, Zone } from "@rift/protocol";

/** A unit taking part in a clash (last-known snapshot from the previous room). */
export interface ClashUnit {
  id: string;
  card: CardInstance;
  playerId: string;
  /** Damage taken in this transition (0 when unknown / unharmed). */
  damage: number;
  died: boolean;
  /** Effective might at clash time (drives the weight of the hit); 0 when unknown. */
  might: number;
}

export type FxFromZone = Zone | "chain" | "none";

export type FxEvent =
  | {
      type: "card_played";
      card: CardInstance;
      playerId: string;
      isViewer: boolean;
      fromZone: FxFromZone;
      toZone: Zone;
    }
  | {
      type: "spell_cast";
      card: CardInstance;
      playerId: string;
      isViewer: boolean;
      chainEntryId: string;
      targetIds: string[];
    }
  | {
      type: "spell_resolved";
      card: CardInstance;
      playerId: string;
      isViewer: boolean;
      chainEntryId: string;
      targetIds: string[];
    }
  | {
      type: "unit_moved";
      card: CardInstance;
      playerId: string;
      isViewer: boolean;
      fromZone: Zone;
      toZone: Zone;
    }
  | {
      type: "showdown_start";
      battlefield: BattlefieldZone;
      kind: "combat" | "non_combat";
      startedBy?: string;
    }
  | {
      type: "combat_clash";
      battlefield: BattlefieldZone | null;
      attackers: ClashUnit[];
      defenders: ClashUnit[];
      totalDamage: number;
    }
  | { type: "damage"; card: CardInstance; playerId: string; amount: number }
  | {
      type: "unit_died";
      card: CardInstance;
      playerId: string;
      fromZone: Zone;
      toZone: Zone;
      /** True when this death is part of a combat_clash in the same batch. */
      inCombat: boolean;
    }
  | { type: "might_buff"; card: CardInstance; playerId: string; amount: number }
  | {
      type: "score";
      playerId: string;
      isViewer: boolean;
      delta: number;
      battlefield: BattlefieldZone | null;
      source: "conquer" | "hold" | "other";
    }
  | { type: "conquer"; battlefield: BattlefieldZone; playerId: string; isViewer: boolean }
  | { type: "turn_start"; playerId: string; isViewer: boolean; turnNumber: number }
  | { type: "card_drawn"; playerId: string; isViewer: boolean; count: number };

export type FxEventType = FxEvent["type"];
