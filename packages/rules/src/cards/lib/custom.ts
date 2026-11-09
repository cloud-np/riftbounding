/**
 * Shared (`core:`) custom conditions and effects — one rules-cited implementation of each piece
 * of card text that two or more cards (in any set) need and that is not an engine DSL member
 * (F5/G9). Set-specific ids live in `src/cards/<SET>/custom.ts`.
 *
 * Merged lane ids (maintainability pass; the OGN lanes were later renamed to `ogn:`):
 * `ogn-oz:self-in-combat`, `sfd:self-in-combat`, `ven:self-in-combat`, `ogn-an:in-combat` →
 * `core:in-combat`; `sfd:attacking`, `unl:is-attacking` → `core:attacking`; `ogn-an:legion`,
 * `ogn-oz:legion` → `core:legion`; `ogn-oz:take-control`, `sfd:take-control` →
 * `core:take-control`; `unl:you-have-units-at-it`, `ven:you-have-units-at-it` →
 * `core:you-have-units-at-it`; `sfd:draw-ref`, `unl:draw-ref`, `rad:draw-card` →
 * `core:draw-ref`; `rad:base-might-becomes`, `ven:base-might-becomes` →
 * `core:base-might-becomes`.
 */
import type { Amount, Condition, Selector } from "@rift/protocol";
import {
  evaluateAmount,
  refIds,
  registerCustomCondition,
  resolveSelector,
} from "../../effects/evaluate";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops/control";
import { costsOf, controllerOf, locate, locationOf } from "../../effects/objects";
import { ctxOf } from "../../effects/ops/util";
import { recordOutcome, targets } from "../../effects/targets";
import { legionActive } from "../../play/keyword-helpers";
import { hasUnitPresentAt } from "../../state/presence";
import { pushEvent } from "../../types";
import { custom } from "./conditions";

/** The object a `{ ref }` parameter names: `"it"`, a choice/variable key, or (default) the source. */
function subjectOf(ctx: Parameters<typeof refIds>[0], ref: unknown): string | undefined {
  if (ref === "it") return ctx.env.it ?? undefined;
  if (typeof ref === "string") return refIds(ctx, ref)[0];
  return ctx.env.sourceObjectId;
}

/* ---------------------------------------------------------------- conditions */

/**
 * 740.2.c: "A unit is in combat if it is occupying a battlefield where combat is ongoing and has
 * a combat designation." `ref`: `"it"` or a choice key (default: the ability's source).
 */
registerCustomCondition("core:in-combat", (ctx, params) => {
  const id = subjectOf(ctx, params.ref);
  const combat = ctx.room.rules?.combat;
  if (!id || !combat) return false;
  if (locationOf(ctx.room, ctx.host, id) !== combat.battlefield) return false;
  return !!ctx.room.rules?.objects[id]?.designation;
});

/** "I'm in combat" (740.2.c) for the ability's source. */
export const SELF_IN_COMBAT: Condition = custom("core:in-combat");

/** "… in combat" (740.2.c) for the selector candidate `it`. */
export const IT_IN_COMBAT: Condition = custom("core:in-combat", { ref: "it" });

/**
 * 124.2 / 466.2.c.3: the object (`ref`: `"it"` by default, or a choice key) is attacking — it
 * holds the Attacker designation.
 */
registerCustomCondition("core:attacking", (ctx, params) => {
  const id = params.ref === undefined ? (ctx.env.it ?? undefined) : subjectOf(ctx, params.ref);
  return !!id && ctx.room.rules?.objects[id]?.designation === "attacker";
});

/** [Legion] (812.1.c): the controller has Finalized another card than the source this turn. */
registerCustomCondition("core:legion", (ctx) =>
  legionActive(ctx.room, ctx.env.controller, ctx.env.sourceObjectId),
);

/** 812: "[Legion] — …" condition. */
export const LEGION: Condition = custom("core:legion");

/**
 * "a battlefield where you have units": `it` is a battlefield object (`battlefield:<zone>`, or
 * the bare zone) at which the controller has a face-up unit (107.3).
 */
registerCustomCondition("core:you-have-units-at-it", (ctx) => {
  const id = ctx.env.it;
  if (!id) return false;
  const zone = id.startsWith("battlefield:") ? id.slice("battlefield:".length) : id;
  return hasUnitPresentAt(ctx.room, ctx.host, ctx.env.controller, zone);
});

/* ---------------------------------------------------------------- effects */

/** "Take control of it" (056 / 427): the ability's controller gains control of each target. */
registerCustomEffect("core:take-control", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const controller = context.machine?.env.controller ?? context.controller;
  const done: string[] = [];
  for (const id of found.ids) {
    const previous = controllerOf(context.room, host, id);
    if (!previous || previous === controller) continue;
    if (!host.setController(context.room, id, controller)) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "gain_control",
      cardId: id,
      playerId: controller,
      data: { from: previous },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

/**
 * "Draw it" (414.1: drawing takes a card from a zone into its player's hand): each card bound
 * to `ref` that is still in its owner's Main Deck goes to that player's hand, one `draw` event
 * per card (414.1: "a single card").
 */
registerCustomEffect("core:draw-ref", (params, context) => {
  const ctx = ctxOf(context);
  const host = ctx.host;
  const drawn: string[] = [];
  for (const id of refIds(ctx, typeof params.ref === "string" ? params.ref : "it")) {
    const located = locate(context.room, host, id);
    if (!located || located.zone !== "deck") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    drawn.push(id);
    pushEvent(context.step.events, {
      type: "draw",
      playerId: located.playerId,
      amount: 1,
      data: { cardIds: [id] },
    });
  }
  recordOutcome(context, drawn, drawn.length > 0);
  return RESOLVED;
});

/**
 * "Its base Might becomes N this turn" for `selector` (default `it`): a this-turn Might change of
 * N − base Might (143.2; trait-altering "becomes" is approximated in the 479 arithmetic layer).
 * `value` is a number or an Amount; `energyCostOf` uses that object's Energy cost instead.
 */
registerCustomEffect("core:base-might-becomes", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = ctxOf(context);
  const ids = params.selector
    ? resolveSelector(ctx, params.selector as Selector)
    : machine.env.it
      ? [machine.env.it]
      : [];
  let value: number | null = typeof params.value === "number" ? Math.trunc(params.value) : null;
  if (value === null && params.value && typeof params.value === "object") {
    value = evaluateAmount(ctx, params.value as Amount);
    if (value !== null) value = Math.trunc(value);
  }
  if (params.energyCostOf) {
    const [sourceId] = resolveSelector(ctx, params.energyCostOf as Selector);
    value = sourceId ? (costsOf(ctx.room, ctx.host, sourceId)?.energy ?? null) : null;
  }
  if (value === null) return RESOLVED;
  machine.push(
    ...ids.map((id) => {
      const base =
        ctx.room.rules?.objects[id]?.baseMight ?? ctx.host.cardInfo(ctx.room, id)?.might ?? 0;
      return {
        effect: {
          op: "temporary_might" as const,
          amount: value! - base,
          target: { targetRef: `obj:${id}` },
        },
      };
    }),
  );
  return RESOLVED;
});
