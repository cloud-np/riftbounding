/**
 * Cost adjustments — rules 356.3/356.4 (increases and discounts), 366.2 (cost passives apply in
 * any zone the card can be played from), 475–479 (cost layer, 479.4.a).
 *
 * Owner: R2-effects. Consumer: R2-play (356 total cost and cost modifiers).
 * Semantics: negative values are discounts, positive values are increases. One entry per
 * applicable modifier; `sourceObjectId`/`rule` identify where it comes from.
 *
 * Modifiers read:
 * - `{ kind: "cost", amount, target, cardType? }` — Energy change for matching cards;
 * - `{ kind: "custom", id: "cost-adjust", params: { energy?, power?, target, once? } }` — Energy
 *   and/or Power changes; `once: true` marks "the next card you play this turn costs … less"
 *   (420.5 / EX[203]), consumed by `consumeOnceCostEffects` when that card is played.
 *
 * The target selector is matched against the card being played wherever it is (366.2.a), for
 * the modifier's controller ("you play" = `controller: "self"`).
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { Amount, Room, RuleRef, RulesDomain, Selector } from "@rift/protocol";
import type { RulesHost } from "../host";
import { activeModifiers } from "./passives";
import { modifierTargets } from "./index";

export interface CostAdjustment {
  energy?: number;
  power?: Partial<Record<RulesDomain | "any", number>>;
  sourceObjectId?: string;
  rule?: RuleRef;
  note?: string;
}

function fixed(amount: Amount | undefined): number {
  if (typeof amount === "number") return amount;
  if (amount && typeof amount === "object" && amount.kind === "fixed") return amount.value;
  return 0;
}

export function costAdjustments(
  room: Room,
  host: RulesHost,
  query: { playerId: string; cardId?: string; objectId?: string; abilityRef?: string },
): CostAdjustment[] {
  const out: CostAdjustment[] = [];
  const subject = query.cardId ?? query.objectId;
  if (!room.rules || !subject) return out;
  for (const active of activeModifiers(room, host)) {
    const modifier = active.modifier;
    if (active.controller !== query.playerId) continue;
    if (modifier.kind === "cost") {
      if (modifier.cardType) {
        const type = (host.cardInfo(room, subject)?.type ?? "").toLowerCase();
        if (!type.includes(modifier.cardType.toLowerCase())) continue;
      }
      if (!modifierTargets(room, host, active, subject, 1, { ignoreZone: true })) continue;
      const energy = fixed(modifier.amount);
      if (energy === 0) continue;
      out.push({
        energy,
        sourceObjectId: active.sourceId,
        rule: energy < 0 ? "356.4" : "356.3",
      });
      continue;
    }
    if (modifier.kind === "custom" && modifier.id === "cost-adjust") {
      const params = modifier.params ?? {};
      const target = params.target as Selector | undefined;
      if (target && !modifierTargets(room, host, active, subject, 1, { ignoreZone: true, target })) continue;
      const energy = typeof params.energy === "number" ? params.energy : 0;
      const power = (params.power as Partial<Record<RulesDomain | "any", number>> | undefined) ?? undefined;
      if (energy === 0 && (!power || Object.keys(power).length === 0)) continue;
      out.push({
        ...(energy !== 0 ? { energy } : {}),
        ...(power ? { power } : {}),
        sourceObjectId: active.sourceId,
        rule: energy < 0 || Object.values(power ?? {}).some((value) => (value ?? 0) < 0) ? "356.4" : "356.3",
        ...(params.once ? { note: "once" } : {}),
      });
    }
  }
  return out;
}

/**
 * 420.5 / EX[203]: "the next card you play this turn costs … less" applies to the next Play
 * game action of that player and is then used up. Called by the effects layer on `card_played`.
 */
export function consumeOnceCostEffects(room: Room, playerId: string): number {
  const rules = room.rules;
  if (!rules) return 0;
  const before = rules.effects.length;
  rules.effects = rules.effects.filter((effect) => {
    const modifier = effect.modifier;
    if (modifier.kind !== "custom" || modifier.id !== "cost-adjust") return true;
    if (!modifier.params?.once) return true;
    return effect.controller !== playerId;
  });
  return before - rules.effects.length;
}
