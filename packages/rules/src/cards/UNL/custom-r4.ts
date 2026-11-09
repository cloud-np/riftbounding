/**
 * Unleashed (UNL) R4 card-specific conditions and effects (`unl:` prefix).
 *
 * Import-time registry entries only (no game state); each reads the room through the shared
 * evaluator helpers.
 */
import { controllerOf, evalContextOf, idsOf, isUnit, locate, mightOf, pushEvent, recordOutcome, refIds, registerCustomCondition, registerCustomEffect, RESOLVED, setXp, xpOf } from "../sdk";

/* ---------------------------------------------------------------- conditions */

/**
 * Altar of Blood — "If a unit here would die during combat": a Combat is in progress (461–468).
 * Used as the matcher condition of the battlefield replacement, evaluated while the kill is
 * still being proposed (the unit is on the board).
 */
registerCustomCondition("unl:in-combat", (ctx) => !!ctx.room.rules?.combat);

/**
 * Repulse — the chosen enemy spell or ability "chooses it and no other friendly unit".
 *
 * The candidate Chain Item is the selector's `it`; `ref` names the chosen friendly unit
 * (`target:0`). Every object id among the item's bound choices is inspected: the chosen unit must
 * be one of them and no other friendly unit may be.
 */
registerCustomCondition("unl:item-chooses-only", (ctx, params) => {
  const itemId = ctx.env.it;
  const item = itemId ? ctx.room.rules?.chain.find((entry) => entry.id === itemId) : undefined;
  if (!item || item.kind === "token") return false;
  if (item.kind === "card") {
    const type = (item.cardSnapshot?.type ?? "").toLowerCase();
    if (!type.includes("spell")) return false;
  }
  const ref = typeof params.ref === "string" ? params.ref : "target:0";
  const wanted = refIds(ctx, ref);
  if (wanted.length === 0) return false;
  const targets: string[] = [];
  for (const value of Object.values(item.choices ?? {})) targets.push(...idsOf(value));
  if (!wanted.some((id) => targets.includes(id))) return false;
  for (const id of targets) {
    if (wanted.includes(id)) continue;
    if (isUnit(ctx.room, ctx.host, id) && controllerOf(ctx.room, ctx.host, id) === ctx.env.controller) {
      return false;
    }
  }
  return true;
});

/* ---------------------------------------------------------------- effects */

/** "For each unit this kills, gain 1 XP" (730.1) after a `deal_split` instruction. */
registerCustomEffect("unl:xp-per-kill", (_params, context) => {
  const ctx = evalContextOf(context);
  let kills = 0;
  for (const id of idsOf(ctx.env.vars.$affected)) {
    const object = ctx.room.rules?.objects[id];
    const damage = object?.damage ?? 0;
    if (damage <= 0) continue;
    const located = locate(ctx.room, ctx.host, id);
    if (!located) continue;
    const might = mightOf(ctx, id);
    if (might !== null && damage >= might) kills += 1;
  }
  if (kills <= 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const player = ctx.env.controller;
  setXp(context.room, player, xpOf(context.room, player) + kills);
  pushEvent(context.step.events, {
    type: "gain_xp",
    playerId: player,
    amount: kills,
    data: { xp: xpOf(context.room, player), rule: "730.1" },
  });
  recordOutcome(context, [], true);
  return RESOLVED;
});
