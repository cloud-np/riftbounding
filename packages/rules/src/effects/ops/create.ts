/**
 * `create` — rule 440, Tokens 179–187.
 *
 * 182/183/440.4: the creating effect's controller owns and controls the token. 440.2.b.1:
 * permanents are created at a location they can be played to (default: the controller's base).
 * 184.1: the effect may say the token enters ready/exhausted; by default played units enter
 * exhausted (143.4) and gear ready (149.1). 187: token characteristics (Recruit 1 [M], Gold gear,
 * …) come from the engine's token catalog; `TokenSpec.might/keywords/tags` override/add.
 * `TokenSpec.play` marks "play a … token" (440.2.c): the token counts as played
 * (`unit_played`/`gear_played` with `data.token`).
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../../host";
import { pushEvent } from "../../types";
import { createTokenPrimitive } from "../../actions/tokens";
import { addKeywordGrant } from "../../layers/mods";
import { enterReadyApplies } from "../../layers/entry";
import { RESOLVED } from "../execute";
import { resolveZoneNames } from "../evaluate";
import { registerEffectOp } from "../registry";
import { recordOutcome } from "../targets";
import { ctxOf, hostOf, playersOf } from "./util";
import { locate, locationZones } from "../objects";

function setTags(room: Room, host: RulesHost, id: string, tags: string[]): void {
  const located = locate(room, host, id);
  if (located) located.card.subtypes = [...tags];
}

registerEffectOp("create", (effect, context) => {
  if (effect.op !== "create") return { status: "manual", reason: "effect_not_implemented:create" };
  const host = hostOf(context);
  const ctx = ctxOf(context);
  const spec = effect.token;
  const count = Math.max(0, spec.count ?? 1);
  const zoneSelector = effect.zone ?? spec.zone;
  const zones = zoneSelector ? resolveZoneNames(ctx, zoneSelector) : ["base"];
  const zone = zones.find((entry) => locationZones(context.room, host).includes(entry)) ?? "base";
  const created: string[] = [];
  for (const playerId of playersOf(context, effect.player)) {
    for (let index = 0; index < count; index += 1) {
      const id = createTokenPrimitive(context.room, playerId, spec.name, zone, context.step);
      if (!id) continue;
      created.push(id);
      const info = host.cardInfo(context.room, id);
      const type = (spec.type ?? info?.type ?? "").toLowerCase();
      const isUnit = type.includes("unit");
      const rules = context.room.rules;
      if (rules && isUnit) {
        const object = (rules.objects[id] ??= {});
        const might = spec.might ?? info?.might;
        if (typeof might === "number") object.baseMight = might;
        object.enteredThisTurn = true;
      }
      if (spec.tags) setTags(context.room, host, id, spec.tags);
      for (const keyword of spec.keywords ?? []) {
        addKeywordGrant(context.room, host, id, keyword, "permanent", playerId);
      }
      let exhausted = spec.exhausted ?? isUnit;
      // e.g. "Units you play to battlefields you control enter ready" (a replacement, 369.3).
      if (exhausted && isUnit && spec.play && enterReadyApplies(context.room, host, id, playerId, zone)) {
        exhausted = false;
      }
      host.setExhausted(context.room, id, exhausted);
      if (spec.play) {
        pushEvent(context.step.events, {
          type: isUnit ? "unit_played" : "gear_played",
          cardId: id,
          playerId,
          zone,
          cardName: spec.name,
          data: { token: true },
        });
      }
    }
  }
  recordOutcome(context, created, created.length > 0);
  return RESOLVED;
});
