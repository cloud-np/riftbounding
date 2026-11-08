/**
 * `recycle` — rule 417.
 *
 * 417.1: put cards on the bottom of the corresponding deck (runes → Rune Deck, everything else →
 * Main Deck), always the owner's (417.1.c / 056). 417.4: as many as possible. 417.5: two or more
 * cards recycled to the Main Deck together go in a random order. 417.6: "Recycle X from [zone]"
 * is the player's choice and does not target.
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../execute";
import { resolveZoneNames } from "../evaluate";
import { registerEffectOp } from "../registry";
import { optionFor, recordOutcome, targets, noteLki } from "../targets";
import { amountOf, ctxOf, forgetObject, hostOf } from "./util";
import { locate, typeOf } from "../objects";

registerEffectOp("recycle", (effect, context) => {
  if (effect.op !== "recycle") return { status: "manual", reason: "effect_not_implemented:recycle" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const machine = context.machine;
  let ids: string[] = [];
  if (effect.amount !== undefined && effect.from !== undefined) {
    const amount = Math.max(0, amountOf(context, effect.amount) ?? 0);
    const zones = resolveZoneNames(ctx, effect.from);
    const pool = zones.flatMap((zone) => host.zoneCards(context.room, ctx.env.controller, zone).map((card) => card.id));
    if (amount === 0 || pool.length === 0) {
      recordOutcome(context, [], false);
      return RESOLVED;
    }
    if (pool.length <= amount) {
      ids = pool;
    } else if (machine && machine.frame.answer !== undefined) {
      const answer = machine.frame.answer;
      ids = (Array.isArray(answer) ? answer : [answer]).filter((id): id is string => typeof id === "string" && pool.includes(id));
      machine.frame.answer = undefined;
    } else if (machine) {
      return machine.ask({
        kind: "choose-card",
        playerId: ctx.env.controller,
        options: pool.map((id) => optionFor(ctx, id)),
        min: amount,
        max: amount,
        rule: "417.6",
        promptKey: "rules.prompt.chooseRecycle",
        data: { answer: "objects" },
      });
    }
  } else {
    const found = targets(context, effect.target);
    if (!found.ok) return found.result;
    ids = found.ids;
  }
  // 417.5: random order for several Main Deck cards.
  const order = [...ids];
  if (order.length > 1) {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(host.rng() * (index + 1));
      [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
  }
  noteLki(ctx, order);
  const done: string[] = [];
  for (const id of order) {
    const located = locate(context.room, host, id);
    if (!located) continue;
    const isRune = typeOf(context.room, host, id).includes("rune");
    const to = effect.to ?? (isRune ? "runeDeck" : "deck");
    if (!host.moveCardToOwnerZone(context.room, id, to, "bottom")) continue;
    forgetObject(context.room, host, id);
    done.push(id);
    pushEvent(context.step.events, {
      type: "recycle",
      cardId: id,
      playerId: located.card.ownerPlayerId ?? located.playerId,
      zone: to,
      data: { from: located.zone },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});
