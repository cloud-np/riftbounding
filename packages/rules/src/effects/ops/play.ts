/**
 * `play` — rule 420.3 (a Limited Play during resolution).
 *
 * 420.3.b: all steps of play are normal except as the instruction says (cost ignored / free,
 * location). 402.2: while an effect is resolving the new item only joins the chain as a Pending
 * Item; HOT FEPR finalizes it after the current resolution (units resolve on finalize, 337.2).
 * 420.3.c: nothing eligible → nothing happens. `cost: "normal"` pays through R2-play's
 * `payCost`; an unpaid play is undone (358.5).
 *
 * TODO(R2-play): additional costs/choices of the played card (355) are not asked here; the
 * card's own `requiredChoices` are bound by its play-time flow once R2-play wires it.
 */
import type { ChainItem } from "@rift/protocol";
import { pushEvent } from "../../types";
import { costSummary, printedCardCost } from "../../play/cost-model";
import { payCost } from "../../play/payment";
import { appendChainItem } from "../../timing/fepr/chain";
import { RESOLVED } from "../execute";
import { resolveZoneNames } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome, targets } from "../targets";
import { ctxOf, hostOf } from "./util";
import { locate, locationZones } from "../objects";

registerEffectOp("play", (effect, context) => {
  if (effect.op !== "play") return { status: "manual", reason: "effect_not_implemented:play" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const rules = context.room.rules;
  const found = targets(context, effect.target);
  if (!found.ok) return found.result;
  const zones = effect.location ? resolveZoneNames(ctx, effect.location) : ["base"];
  const location = zones.find((zone) => locationZones(context.room, host).includes(zone)) ?? "base";
  const played: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    if (!rules || !located) continue;
    const info = host.cardInfo(context.room, id);
    if ((effect.cost ?? "normal") === "normal") {
      const verdict = payCost(context.room, context.step, ctx.env.controller, {
        ...(info?.energyCost ? { energy: info.energyCost } : {}),
      });
      if (!verdict.ok) continue; // 358.5: the play is undone
    }
    const snapshot = host.takeCard(context.room, located.playerId, located.zone, id);
    if (!snapshot) continue;
    const type = (info?.type ?? snapshot.type ?? "").toLowerCase();
    const item: ChainItem = {
      id: host.nextId("chain"),
      kind: "card",
      status: "pending",
      controller: ctx.env.controller,
      cardName: info?.name ?? snapshot.name,
      ...(snapshot.cardCode ? { cardCode: snapshot.cardCode } : {}),
      choices: type.includes("unit") || type.includes("gear") ? { location: type.includes("unit") ? location : "base" } : {},
      origin: "play",
      fromZone: located.zone,
      cardSnapshot: snapshot,
      addedAt: host.now(),
      // 420.3.b / 355.2.b / 359.2.c: the instruction's location choice was validated when the
      // effect resolved, so `resolvePermanent` must not re-check friendly presence. `totalCost`
      // is the existing "location validated by the play process" marker.
      totalCost: (effect.cost ?? "normal") === "ignored"
        ? { energy: 0, power: 0 }
        : costSummary(printedCardCost(info)),
    };
    appendChainItem(context.room, item, context.step);
    rules.history.cardsPlayedThisTurn[ctx.env.controller] = (rules.history.cardsPlayedThisTurn[ctx.env.controller] ?? 0) + 1;
    played.push(id);
    pushEvent(context.step.events, {
      type: "card_played",
      cardId: id,
      playerId: ctx.env.controller,
      cardName: item.cardName,
      data: { itemId: item.id, limited: true, cost: effect.cost ?? "normal", from: located.zone },
    });
  }
  recordOutcome(context, played, played.length > 0);
  return RESOLVED;
});
