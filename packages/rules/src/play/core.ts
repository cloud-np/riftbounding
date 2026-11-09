/**
 * Steps 2–5 of playing a card or an ability — rules 355 (choices), 356 (total cost), 357 (pay),
 * 358.1/358.2 (legality), shared by card plays (349–359) and activations (399–407).
 *
 * Pure: the result is a plan. A pending choice (355) or cost-object choice (357.2) is reported
 * instead of failing so the process can prompt (411.2). The total cost is computed even while a
 * choice is pending (from the choices bound so far) so an unaffordable play is rejected before
 * it reaches the chain (420.2.a); Deflect (809) can only add cost, so that is a lower bound.
 */
import type { Ability, ChoiceRecord, GameEvent, PaymentPlanWire, Room } from "@rift/protocol";
import type { CardInfo, RulesHost } from "../host";
import type { RulesFailure } from "../types";
import { validateChoices, type ChoiceSpec } from "../effects/choices";
import { additionalCostsFor, type AdditionalCostSpec } from "./additional-costs";
import { bindChoices, effectsSpecProvider, type ChoiceSpecProvider } from "./choices";
import type { CostObjectChoice } from "./cost-objects";
import type { PowerDomain, ResolvedCost } from "./cost-model";
import { formatSymbolCost, resolveCost } from "./cost-model";
import { cardKeywords } from "./keywords";
import { planPayment, type PaymentPlan } from "./payment";
import type { PlayPermission } from "./permissions";
import { optionalCostMarker } from "./request";
import { determineTotalCost, validateOptionalCosts } from "./total-cost";
import { showOffChoiceSpecs, showOffSpecs } from "./show-off";

export interface CoreInput {
  playerId: string;
  kind: "card" | "activated";
  /** Card id (card plays) or source object id (activations). */
  sourceId: string;
  abilityRef?: string;
  /** The ability whose choices are made (spell ability / activated ability), if scripted. */
  ability?: Ability;
  info: CardInfo | null;
  keywords: readonly string[];
  domains: readonly PowerDomain[];
  base: ResolvedCost;
  permission?: Pick<PlayPermission, "cost" | "ignore" | "ignoreAll"> | undefined;
  choices: ChoiceRecord;
  optionalCosts: readonly string[];
  /**
   * 355.1.a: whether the intent carried an explicit `optionalCosts` field. Absent/false means
   * the engine offers affordable optional additional costs as yes/no prompts; an explicit field
   * (including `[]`) keeps the caller's choice and never prompts. Defaults to true.
   */
  optionalCostsDeclared?: boolean;
  plan?: PaymentPlanWire;
  /** Cards that cannot pay costs (the card being played while still in hand). */
  excludeIds?: readonly string[];
  itemId?: string;
  facedownAt?: string;
  /** Extra additional costs supplied by the caller (e.g. an Equip alternative). */
  extraAdditional?: readonly AdditionalCostSpec[];
  /** Choice specs of a built-in ability (replaces R2-effects' `requiredChoices`). */
  specProvider?: ChoiceSpecProvider;
  /** 383.2.c.3.b: the trigger event a triggered ability's choices are scanned against. */
  event?: GameEvent;
}

/** 355.1.a: one affordable optional additional cost the player has not decided yet. */
export interface OptionalCostOffer {
  spec: AdditionalCostSpec;
  /** Display text for the prompt: keyword + symbols ("Accelerate [1][Order]") or the printed phrase. */
  costText: string;
}

export interface CorePlan {
  ok: true;
  choices: ChoiceRecord;
  targetKeys: string[];
  pendingChoice: ChoiceSpec | null;
  /**
   * 355.1.a: optional additional costs awaiting a yes/no answer, in rule order. Only populated
   * when the intent omitted `optionalCosts`; asks one at a time.
   */
  pendingOptional: OptionalCostOffer[];
  additional: AdditionalCostSpec[];
  cost: ResolvedCost;
  payment: PaymentPlan | null;
  pendingCost: CostObjectChoice | null;
}

export type CoreResult = CorePlan | RulesFailure;

/**
 * 355.1.a: display text for the yes/no prompt. Accelerate/Repeat name the keyword and show its
 * symbols; a printed “you may pay X as an additional cost” phrase is already its own text.
 */
function optionalCostText(
  spec: AdditionalCostSpec,
  domains: readonly PowerDomain[],
  choices: ChoiceRecord,
): string {
  const symbols = formatSymbolCost(resolveCost(spec.cost, domains, { choices }));
  const keyword = spec.id === "accelerate" || /^repeat(?::\d+)?$/.test(spec.id);
  if (keyword) return [spec.label ?? spec.id, symbols].filter((part) => part.length > 0).join(" ");
  return spec.label ?? (symbols.length > 0 ? symbols : spec.id);
}

export function planCore(room: Room, host: RulesHost, input: CoreInput): CoreResult {
  // 355.3–355.13: modes, targets, X (R2-effects specs or a built-in provider), in rule order.
  const context = {
    controller: input.playerId,
    sourceObjectId: input.sourceId,
    ...(input.itemId ? { itemId: input.itemId } : {}),
    ...(input.facedownAt ? { facedownAt: input.facedownAt } : {}),
    ...(input.event ? { event: input.event } : {}),
  };
  const effects = input.specProvider ?? (input.ability ? effectsSpecProvider(room, host, input.ability, context) : undefined);
  // 832.1.c.2: the Show Off decision is made while the card is finalized (before its targets).
  const showOff = input.kind === "card" && showOffSpecs(input.info?.name).length > 0
    ? (): ChoiceSpec[] => showOffChoiceSpecs(room, host, input.playerId, input.sourceId)
    : undefined;
  const provider: ChoiceSpecProvider | undefined =
    showOff && effects ? (choices) => [...showOff(), ...effects(choices)] : (showOff ?? effects);
  const bound = bindChoices(room, host, provider, context, input.choices);
  if (!bound.ok) return bound;
  // 356.2: every additional cost that applies (Deflect needs the bound targets).
  const additional = [
    ...additionalCostsFor(
      room,
      host,
      {
        playerId: input.playerId,
        ...(input.kind === "card" ? { cardId: input.sourceId } : { objectId: input.sourceId }),
        ...(input.abilityRef ? { abilityRef: input.abilityRef } : {}),
        info: input.info,
        keywords: input.keywords,
        kind: input.kind,
        choices: bound.choices,
        targetKeys: bound.targetKeys,
      },
      (id) => cardKeywords(room, host, id),
    ),
    ...(input.extraAdditional ?? []),
  ];
  const optionalInvalid = validateOptionalCosts(additional, input.optionalCosts);
  if (optionalInvalid) return optionalInvalid;
  const adjustment = {
    playerId: input.playerId,
    ...(input.kind === "card" ? { cardId: input.sourceId } : { objectId: input.sourceId }),
    ...(input.abilityRef ? { abilityRef: input.abilityRef } : {}),
  };
  // 357: payment plan (420.2.a: an unaffordable play is not legal).
  const targetIds = bound.targetKeys.flatMap((key) => {
    const value = bound.choices[key];
    return typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  });
  const planFor = (selectedOptionalCosts: readonly string[]) => {
    // 356: total cost.
    const total = determineTotalCost(room, host, {
      playerId: input.playerId,
      base: input.base,
      domains: input.domains,
      permission: input.permission,
      additional,
      optionalCosts: selectedOptionalCosts,
      choices: bound.choices,
      adjustment,
    });
    const payment = planPayment(room, host, input.playerId, total.cost, {
      sourceObjectId: input.sourceId,
      ...(input.excludeIds ? { excludeIds: input.excludeIds } : {}),
      ...(input.plan ? { plan: input.plan } : {}),
      ...(targetIds.length ? { avoidIds: targetIds } : {}),
    });
    return { total, payment };
  };
  const planned = planFor(input.optionalCosts);
  if (!planned.payment.ok) return planned.payment;
  // 355.1.a / 356.2.b.1: when the intent omitted `optionalCosts`, offer each optional additional
  // cost the player can afford on top of the base cost (and of what they already accepted).
  // An explicit `optionalCosts` field (including `[]`) never prompts. A declined cost is marked
  // `cost:<id> = false`; an accepted one is in `input.optionalCosts`.
  const pendingOptional: OptionalCostOffer[] = [];
  if (input.optionalCostsDeclared === false && !bound.pending) {
    const accepted = [...input.optionalCosts];
    for (const spec of additional) {
      if (!spec.optional || accepted.includes(spec.id)) continue;
      if (bound.choices[optionalCostMarker(spec.id)] === false) continue;
      const candidate = planFor([...accepted, spec.id]);
      if (!candidate.payment.ok) continue;
      pendingOptional.push({ spec, costText: optionalCostText(spec, input.domains, bound.choices) });
    }
  }
  // 358.1: the bound choices must be complete and legal (only once nothing is pending). A
  // built-in provider's choices were already validated against its options.
  if (!bound.pending && input.ability && !input.specProvider) {
    const legal = validateChoices(room, host, input.ability, {
      controller: input.playerId,
      sourceObjectId: input.sourceId,
      ...(input.itemId ? { itemId: input.itemId } : {}),
      ...(input.event ? { event: input.event } : {}),
      choices: bound.choices,
    });
    if (!legal.ok) return legal;
  }
  return {
    ok: true,
    choices: bound.choices,
    targetKeys: bound.targetKeys,
    pendingChoice: bound.pending,
    pendingOptional,
    additional,
    cost: planned.total.cost,
    payment: planned.payment.plan,
    pendingCost: planned.payment.pending,
  };
}
