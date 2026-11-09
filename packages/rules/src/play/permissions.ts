/**
 * Play permissions — rules 354, 356.1.a/b, 356.5.a, 420.1.a, 811.1.b, 811.6.
 *
 * Where a card may be played from:
 *
 * - its controller's hand or Chosen Champion zone (420.1.a);
 * - facedown at a battlefield, when it was hidden on an earlier turn (811.1.b: "Beginning on
 *   the next turn, this gains [Reaction] and you may play this, ignoring its base cost");
 * - any other zone the card's own script declares (`CardScript.playPermissions`, e.g. Legion "You
 *   may play me from your trash for [3][C]"), or that an effect grants (`registerPlayPermission`
 *   providers, e.g. "until your next Ending Phase, you may play that card").
 *
 * A permission may replace the Base Cost ("for [Cost]", 356.1.a), ignore costs (356.1.b) or
 * all costs (356.5.a), and grant extra permissive keywords.
 */
import type { CardInstance, Cost, Room, RuleRef } from "@rift/protocol";
import type { LocatedCard, RulesHost } from "../host";
import { isBattlefield } from "./control";
import { flowPermission } from "./flow";
import { orderedRegistry } from "../registry-table";
import { cardScriptNames, getCardScript } from "../cards/registry";
import { makeEnv } from "../effects/env";
import { evaluateCondition } from "../effects/evaluate";

export interface PlayPermission {
  /** Stable id recorded on the chain item. */
  id: string;
  rule: RuleRef;
  /** 356.1.a: play "for [Cost]" (replaces the Base Cost). */
  cost?: Cost;
  /** 356.1.b: ignore the Base Energy/Power cost. */
  ignore?: "base" | "energy" | "power";
  /** 356.5.a: ignore any and all costs. */
  ignoreAll?: boolean;
  /** Extra permissive keywords while played this way (e.g. Reaction from facedown, 811.6). */
  keywords?: string[];
  /** 811.1.d: facedown origin battlefield (location + targeting restrictions). */
  facedownAt?: string;
}

export type PlayPermissionProvider = (
  room: Room,
  host: RulesHost,
  query: { playerId: string; card: CardInstance; zone: string; ownerId: string },
) => PlayPermission | null;

const PROVIDER_REGISTRY = orderedRegistry<PlayPermissionProvider>("play permission");
const PROVIDERS = PROVIDER_REGISTRY.list;

/** Grant play permission from another zone (R2-effects / tests). Returns an unsubscribe. */
export function registerPlayPermission(provider: PlayPermissionProvider): () => void {
  return PROVIDER_REGISTRY.register(provider);
}

/** 811.1.b / 811.6: hidden on an earlier turn, by this player, at a battlefield. */
export function facedownPermission(room: Room, host: RulesHost, playerId: string, located: LocatedCard): PlayPermission | null {
  if (!located.card.hidden || !isBattlefield(room, host, located.zone)) return null;
  if (located.playerId !== playerId) return null;
  const object = room.rules?.objects[located.card.id];
  const hiddenTurn = object?.hiddenTurn;
  const turn = room.rules?.turn.number ?? 0;
  // A card hidden by other means (no hiddenTurn) keeps the permissions of its source (422.3).
  if (typeof hiddenTurn !== "number" || hiddenTurn >= turn) return null;
  return {
    id: "facedown",
    rule: "811.1.b",
    ignore: "base",
    keywords: ["Reaction"],
    facedownAt: located.zone,
  };
}

/** 354 / 420.1.a: the permission to play this located card now, or null. */
export function playPermission(room: Room, host: RulesHost, playerId: string, located: LocatedCard): PlayPermission | null {
  if (located.playerId === playerId && (located.zone === "hand" || located.zone === "champion")) {
    return { id: located.zone, rule: "420.1.a" };
  }
  const facedown = facedownPermission(room, host, playerId, located);
  if (facedown) return facedown;
  // R3 — 829.1.b: a Flow spell may be played from its owner's trash for its Flow cost.
  const flow = flowPermission(room, host, playerId, located);
  if (flow) return flow;
  const scripted = scriptPermission(room, host, playerId, located);
  if (scripted) return scripted;
  for (const provider of PROVIDERS) {
    const granted = provider(room, host, {
      playerId,
      card: located.card,
      zone: located.zone,
      ownerId: located.card.ownerPlayerId ?? located.playerId,
    });
    if (granted) return granted;
  }
  return null;
}

/** Zones `legalIntents` scans for playable cards (registered permissions may add others). */
export const DEFAULT_PLAY_ZONES = ["hand", "champion"] as const;
export const EXTRA_PLAY_ZONES = ["trash", "banished", "deck"] as const;

export function hasPlayPermissionProviders(): boolean {
  return PROVIDERS.length > 0 || cardScriptNames().some((name) => (getCardScript(name)?.playPermissions?.length ?? 0) > 0);
}

/** 354 / 420.1.a: a play zone the card's own script declares (`CardScript.playPermissions`). */
function scriptPermission(room: Room, host: RulesHost, playerId: string, located: LocatedCard): PlayPermission | null {
  const permissions = getCardScript(located.card.name)?.playPermissions;
  if (!permissions) return null;
  const ctx = { room, host, env: makeEnv({ controller: playerId, sourceObjectId: located.card.id }) };
  for (const permission of permissions) {
    if (permission.zone !== located.zone) continue;
    if (permission.condition && !evaluateCondition(ctx, permission.condition)) continue;
    return {
      id: permission.id,
      rule: permission.rule as RuleRef,
      ...(permission.cost ? { cost: permission.cost } : {}),
      ...(permission.ignore ? { ignore: permission.ignore } : {}),
      ...(permission.ignoreAll ? { ignoreAll: true } : {}),
    };
  }
  return null;
}
