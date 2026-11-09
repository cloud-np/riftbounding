/**
 * Restrictions ("can't …") — rules 054–056 (Can't beats Can), 356–358, 475–479 (restriction
 * layer), 756–758 (Untargetability), 467.2.c.10.
 *
 * Owner: R2-effects. Consumers: R2-play (play/activate/move/targets) and R2-combat
 * (467.2.c.10 “can't be dealt damage”).
 * Semantics: returns the active restriction for the query, or `null` when the action is allowed.
 *
 * Restrictions come from `{ kind: "restriction", restriction, target }` modifiers (passive
 * abilities on the board and continuous effects). `restriction` is a `RestrictionKind`,
 * optionally qualified:
 *
 * - `"be-targeted:enemy"` — 757.1 "can't be chosen by enemy spells and abilities": applies only
 *   when the choosing source's controller is an opponent of the object's controller;
 * - `"be-targeted:spells"` / `"be-targeted:abilities"` — only for that category of source;
 * - plain kinds apply to everything (054.1: a forbidding effect beats any permission).
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Modifier, Room, RuleRef } from "@rift/protocol";
import type { RulesHost } from "../host";
import { getCardScript } from "../cards/registry";
import { activeModifiers, evaluateLayerCondition } from "./passives";
import { modifierTargets } from "./index";

export type RestrictionKind =
  | "play"
  | "activate"
  | "move"
  | "be-targeted"
  | "be-dealt-damage"
  | "attack"
  | "defend"
  | "ready"
  | "score";

export interface RestrictionQuery {
  kind: RestrictionKind;
  playerId?: string;
  objectId?: string;
  cardId?: string;
  sourceObjectId?: string;
  to?: string;
}

const RULE_FOR: Record<RestrictionKind, RuleRef> = {
  play: "054.1",
  activate: "054.1",
  move: "054.1",
  "be-targeted": "758",
  "be-dealt-damage": "467.2.c.10",
  attack: "054.1",
  defend: "054.1",
  ready: "054.1",
  score: "054.1",
};

function controllerOfObject(room: Room, host: RulesHost, id: string | undefined): string | null {
  if (!id) return null;
  const item = room.rules?.chain.find((entry) => entry.id === id);
  if (item) return item.controller;
  return host.findCard(room, id)?.playerId ?? null;
}

function sourceCategory(room: Room, host: RulesHost, id: string | undefined): "spell" | "ability" | null {
  if (!id) return null;
  const item = room.rules?.chain.find((entry) => entry.cardSnapshot?.id === id || entry.id === id);
  if (item) return item.kind === "card" ? "spell" : "ability";
  const located = host.findCard(room, id);
  if (!located) return null;
  const type = (host.cardInfo(room, id)?.type ?? "").toLowerCase();
  return type.includes("spell") ? "spell" : "ability";
}

/** 364.3.a: unwrap a `conditional` modifier for its source (same shape as `passives.ts`). */
function unwrapModifier(
  room: Room,
  host: RulesHost,
  modifier: Modifier,
  scope: { controller: string; sourceObjectId?: string; depth: number },
): Modifier | null {
  if (modifier.kind === "custom" && modifier.id === "conditional") {
    const params = modifier.params ?? {};
    const condition = params.condition as Parameters<typeof evaluateLayerCondition>[2] | undefined;
    const inner = params.modifier as Modifier | undefined;
    if (!inner) return null;
    if (condition && !evaluateLayerCondition(room, host, condition, scope)) return null;
    return unwrapModifier(room, host, inner, scope);
  }
  return modifier;
}

/**
 * 054.1 / 355.17.b: a "can't be played" restriction printed on the card itself. `activeModifiers`
 * only reads passives of objects on the Board, so a restriction on a card in hand (Ol' Poro: "I
 * can't be played on your first, second or third turns") is invisible to the loop above. Read the
 * subject card's own script passives directly, in any zone (the plan text of a card in hand is
 * still a restriction: 054.1 "can't beats can").
 */
function selfPlayRestriction(
  room: Room,
  host: RulesHost,
  cardId: string,
): { rule?: RuleRef; sourceObjectId?: string; note?: string } | null {
  const info = host.cardInfo(room, cardId);
  const script = info ? getCardScript(info.name) : undefined;
  if (!script) return null;
  const controller = controllerOfObject(room, host, cardId) ?? "";
  const scope = { controller, sourceObjectId: cardId, depth: 1 };
  for (const ability of script.abilities) {
    if (ability.kind !== "passive") continue;
    const modifier = unwrapModifier(room, host, ability.modifier, scope);
    if (!modifier || modifier.kind !== "restriction") continue;
    const [kind] = modifier.restriction.split(":", 2);
    if (kind !== "play") continue;
    const active = { sourceId: cardId, controller, modifier, origin: "passive" as const, timestamp: 0 };
    if (!modifierTargets(room, host, active, cardId, 1, { ignoreZone: true })) continue;
    return { rule: RULE_FOR.play, sourceObjectId: cardId, note: modifier.restriction };
  }
  return null;
}

export function restrictionFor(
  room: Room,
  host: RulesHost,
  query: RestrictionQuery,
): { rule?: RuleRef; sourceObjectId?: string; note?: string } | null {
  if (!room.rules) return null;
  const subject = query.objectId ?? query.cardId;
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (modifier.kind !== "restriction") continue;
    const [kind, qualifier] = modifier.restriction.split(":", 2);
    if (kind !== query.kind) continue;
    if (subject && !modifierTargets(room, host, active, subject, 1)) continue;
    if (!subject) continue;
    if (query.kind === "be-targeted" && qualifier) {
      const objectController = controllerOfObject(room, host, subject);
      const chooser = query.playerId ?? controllerOfObject(room, host, query.sourceObjectId);
      if (qualifier === "enemy") {
        if (!objectController || !chooser || objectController === chooser) continue;
      } else if (qualifier === "spells" || qualifier === "abilities") {
        const category = sourceCategory(room, host, query.sourceObjectId);
        if (category !== (qualifier === "spells" ? "spell" : "ability")) continue;
      }
    }
    return {
      rule: RULE_FOR[query.kind],
      sourceObjectId: active.sourceId,
      note: modifier.restriction,
    };
  }
  // 054.1: the played card's own "can't be played" text (it is in hand, not on the Board). A
  // location query (`to`) is about the destination, not the card itself.
  if (query.kind === "play" && query.cardId && query.to === undefined) return selfPlayRestriction(room, host, query.cardId);
  return null;
}
