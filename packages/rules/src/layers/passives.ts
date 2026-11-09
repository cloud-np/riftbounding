/**
 * Active modifiers — rules 363–366 (passive abilities), 391.4 (delayed passives), 475–482,
 * 716–719 (attachments), 720–727 (Inactive / Dependent Keywords).
 *
 * Collects every modifier that currently applies, in timestamp order (482.3: board passives
 * first in board order, then continuous effects in creation order):
 *
 * - passive abilities of scripted objects on the Board (365.1) and of the battlefields;
 * - 718.2/724: an attached card's own rules text is Inactive; only its effect text (modelled as
 *   passives whose target is `{ targetRef: "host" }`) applies, to the top-most card (718.3/.4);
 * - `{ kind: "while", condition, modifier }` wraps a conditional passive (364.3.a) or a Dependent
 *   Keyword ability (727.1.b: Inactive until the condition holds);
 * - continuous effects in `rules.effects` whose duration is active (`durations.ts`).
 *
 * `depth` breaks layer self-references (478.1.c): nested evaluations at depth ≥ 1 see only base
 * values and object-level modifiers.
 */
import type { CardInstance, Condition, Modifier, Room } from "@rift/protocol";
import type { RulesHost } from "../host";
import { getCardScript } from "../cards/registry";
import { durationActive } from "./durations";
import { hasUnitPresentAt } from "../state/presence";
import { upgradeLegacyModifier } from "./legacy";

export interface ActiveModifier {
  /** Object id, `battlefield:<zone>` or the continuous effect's source. */
  sourceId: string;
  controller: string;
  modifier: Modifier;
  origin: "passive" | "effect";
  effectId?: string;
  /** Relative timestamp (482): index in collection order. */
  timestamp: number;
}

/** Evaluates a condition for a passive's source; injected to avoid an import cycle. */
export type ConditionEvaluator = (
  room: Room,
  host: RulesHost,
  condition: Condition,
  scope: { controller: string; sourceObjectId?: string; depth: number },
) => boolean;

let conditionEvaluator: ConditionEvaluator = () => false;

/** Wired once by `effects/evaluate-bridge.ts` at import time (no game state). */
export function setLayerConditionEvaluator(fn: ConditionEvaluator): void {
  conditionEvaluator = fn;
}

export function evaluateLayerCondition(
  room: Room,
  host: RulesHost,
  condition: Condition,
  scope: { controller: string; sourceObjectId?: string; depth: number },
): boolean {
  return conditionEvaluator(room, host, condition, scope);
}

function unwrap(
  room: Room,
  host: RulesHost,
  stored: Modifier,
  scope: { controller: string; sourceObjectId?: string; depth: number },
): Modifier | null {
  const modifier = upgradeLegacyModifier(stored);
  if (modifier.kind === "while") {
    if (!evaluateLayerCondition(room, host, modifier.condition, scope)) return null;
    return unwrap(room, host, modifier.modifier, scope);
  }
  // 718.2: scripts mark a passive that models printed Rules Text (Inactive while attached) with
  // `{ kind: "rules-text", modifier }`; ordinary passives are Effect Text (718.3). The wrapper
  // itself is transparent while the card is unattached.
  if (modifier.kind === "rules-text") return unwrap(room, host, modifier.modifier, scope);
  return modifier;
}

/** 718.2: is this passive printed Rules Text (Inactive while the card is attached)? */
function isRulesText(modifier: Modifier): boolean {
  if (modifier.kind === "rules-text") return true;
  if (modifier.kind === "while") return isRulesText(modifier.modifier);
  return false;
}

function isHostTargeted(modifier: Modifier): boolean {
  const target = (modifier as { target?: { targetRef?: string } }).target;
  if (target?.targetRef === "host") return true;
  if (modifier.kind === "while" || modifier.kind === "rules-text") return isHostTargeted(modifier.modifier);
  return false;
}

function boardCards(room: Room, host: RulesHost): Array<{ card: CardInstance; controller: string }> {
  const out: Array<{ card: CardInstance; controller: string }> = [];
  const zones = ["base", ...host.battlefieldZones(room), "legend", "runeArea"];
  for (const playerId of host.activePlayerIds(room)) {
    for (const zone of zones) {
      for (const card of host.zoneCards(room, playerId, zone)) out.push({ card, controller: playerId });
    }
  }
  return out;
}

export function activeModifiers(room: Room, host: RulesHost, depth = 0): ActiveModifier[] {
  const out: ActiveModifier[] = [];
  const rules = room.rules;
  if (!rules) return out;
  let timestamp = 0;
  for (const { card, controller } of boardCards(room, host)) {
    const script = getCardScript(card.name);
    if (!script || script.status === "manual") continue;
    const attached = !!card.attachedToCardId;
    for (const ability of script.abilities) {
      if (ability.kind !== "passive") continue;
      const rulesText = isRulesText(ability.modifier);
      const hostTargeted = isHostTargeted(ability.modifier);
      // 718.2: while attached, the card's printed Rules Text is Inactive and its Effect Text
      // (every ordinary passive) is appended to the Top-Most card (718.3 / 724). While
      // unattached, its host-targeted Effect Text has no Top-Most card and is inactive.
      if (attached ? rulesText : hostTargeted) continue;
      const scope = { controller, sourceObjectId: card.id, depth: depth + 1 };
      const modifier = unwrap(room, host, ability.modifier, scope);
      if (!modifier) continue;
      out.push({ sourceId: card.id, controller, modifier, origin: "passive", timestamp: timestamp++ });
    }
  }
  for (const zone of host.battlefieldZones(room)) {
    const name = battlefieldName(room, host, zone);
    const script = name ? getCardScript(name) : undefined;
    if (!script || script.status === "manual") continue;
    const sourceId = `battlefield:${zone}`;
    const present = host.activePlayerIds(room).filter((id) => hasUnitPresentAt(room, host, id, zone));
    const controller = present.length === 1 ? present[0]! : (rules.turn.player ?? "");
    for (const ability of script.abilities) {
      if (ability.kind !== "passive") continue;
      const modifier = unwrap(room, host, ability.modifier, { controller, sourceObjectId: sourceId, depth: depth + 1 });
      if (!modifier) continue;
      out.push({ sourceId, controller, modifier, origin: "passive", timestamp: timestamp++ });
    }
  }
  for (const effect of rules.effects) {
    const stamp = {
      duration: effect.duration,
      turn: typeof effect.expiresAtTurn === "number" ? effect.expiresAtTurn : rules.turn.number,
      controller: effect.controller,
      ...(effect.expiresAtTurn !== undefined ? { expiresAtTurn: effect.expiresAtTurn } : {}),
    };
    if (!durationActive(room, stamp)) continue;
    const scope = {
      controller: effect.controller,
      ...(effect.sourceObjectId ? { sourceObjectId: effect.sourceObjectId } : {}),
      depth: depth + 1,
    };
    if (effect.condition && !evaluateLayerCondition(room, host, effect.condition, scope)) continue;
    const modifier = unwrap(room, host, effect.modifier, scope);
    if (!modifier) continue;
    out.push({
      sourceId: effect.sourceObjectId ?? effect.id,
      controller: effect.controller,
      modifier,
      origin: "effect",
      effectId: effect.id,
      timestamp: timestamp++,
    });
  }
  return out;
}

/** Same zone→battlefield assumption as `effects/objects.ts` (kept local to avoid a cycle). */
function battlefieldName(room: Room, host: RulesHost, zone: string): string | null {
  const zones = host.battlefieldZones(room) as string[];
  const index = zones.indexOf(zone);
  if (index < 0) return null;
  const contributors = room.players.filter((player) => !!player.selectedBattlefield);
  return contributors[index]?.selectedBattlefield?.trim() ?? null;
}
