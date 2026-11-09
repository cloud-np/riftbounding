/**
 * `look` / `search` / `shuffle` — 425/432.1.c (looking never Burns Out; with too few cards look
 * at as many as possible, 432.1.c.1), 412 "search".
 *
 * `look` binds the looked-at card ids (top first) to the variable `looked` and runs `then`;
 * instructions refer to them with `{ targetRef: "looked" }` or a `where: { kind: "in-ref", ref:
 * "looked" }` filter. Cards stay in their zone (425.1.a.2) unless an
 * instruction moves them. `search` lets the player pick one matching card from the zone (bound
 * to `found`) and runs `then`.
 */
import type { Selector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { matchesSelector } from "../evaluate";
import { registerEffectOp } from "../registry";
import { optionFor, recordOutcome } from "../targets";
import { amountOf, ctxOf, hostOf, playersOf } from "./util";

registerEffectOp("look", (effect, context) => {
  if (effect.op !== "look") return { status: "manual", reason: "effect_not_implemented:look" };
  const host = hostOf(context);
  const machine = context.machine;
  const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
  const playerId = playersOf(context, effect.player)[0];
  const zone = effect.zone ?? "deck";
  if (!playerId || amount === 0) return RESOLVED;
  const looked = host.lookAtTop(context.room, playerId, zone, amount).map((card) => card.id);
  if (machine) machine.env.vars.looked = looked;
  pushEvent(context.step.events, { type: "look", playerId, amount: looked.length, zone });
  recordOutcome(context, looked, looked.length > 0);
  if (effect.then && machine) machine.push({ effect: effect.then });
  return RESOLVED;
});

registerEffectOp("search", (effect, context) => {
  if (effect.op !== "search") return { status: "manual", reason: "effect_not_implemented:search" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const machine = context.machine;
  const playerId = playersOf(context, effect.player)[0];
  const zone = effect.zone ?? "deck";
  if (!playerId) return RESOLVED;
  const filter: Selector = { ...(effect.selector ?? {}), zone };
  const pool = host
    .zoneCards(context.room, playerId, zone)
    .map((card) => card.id)
    .filter((id) => matchesSelector(ctx, filter, id));
  let found: string[] = [];
  if (pool.length === 1) found = pool;
  else if (pool.length > 1 && machine && machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    found = (Array.isArray(answer) ? answer : [answer]).filter(
      (id): id is string => typeof id === "string" && pool.includes(id),
    );
    machine.frame.answer = undefined;
  } else if (pool.length > 1 && machine) {
    return machine.ask({
      kind: "choose-card",
      playerId,
      options: pool.map((id) => optionFor(ctx, id)),
      min: 0,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.chooseSearch",
      data: { answer: "objects" },
    });
  }
  if (machine) machine.env.vars.found = found;
  pushEvent(context.step.events, { type: "search", playerId, zone, amount: found.length });
  recordOutcome(context, found, found.length > 0);
  if (effect.then && machine) machine.push({ effect: effect.then });
  return RESOLVED;
});

registerEffectOp("shuffle", (effect, context) => {
  if (effect.op !== "shuffle") return { status: "manual", reason: "effect_not_implemented:shuffle" };
  const host = hostOf(context);
  const zone = effect.zone ?? "deck";
  for (const playerId of playersOf(context, effect.player)) {
    host.shuffle(context.room, playerId, zone);
    pushEvent(context.step.events, { type: "shuffle", playerId, zone });
  }
  return RESOLVED;
});
