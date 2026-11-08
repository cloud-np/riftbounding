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
import type { Room, RuleRef } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";
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
  return null;
}
