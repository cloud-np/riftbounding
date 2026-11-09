/**
 * Unyielding Spirit (OGN-145, FAQ errata) — "[Reaction] Prevent all damage that would be dealt this
 * turn by spells and abilities."
 *
 * A prevention effect (438) for the rest of this turn: every deal action that is not combat damage
 * (467; combat damage proposals carry `data.combat`) is prevented entirely (438.3.c "all"), for
 * every player's spells and abilities. Registers `ogn-oz:noncombat-damage` (condition: the
 * proposed damage is not combat damage) and `ogn-oz:prevent-noncombat-damage-this-turn` (adds the
 * replacement for this turn; unlike the core `replace` op it is not used up after one use).
 */
import { RESOLVED } from "../../effects/execute";
import { registerCustomCondition } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { recordOutcome } from "../../effects/targets";
import { addContinuousEffect } from "../../layers/mods";
import { pushEvent } from "../../types";
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCustomCondition("ogn-oz:noncombat-damage", (ctx) => ctx.env.event?.data?.combat !== true);

registerCustomEffect("ogn-oz:prevent-noncombat-damage-this-turn", (_params, context) => {
  const env = context.machine?.env;
  const controller = env?.controller ?? context.controller;
  const id = addContinuousEffect(context.room, context.step.host, {
    controller,
    duration: "this-turn",
    modifier: {
      kind: "custom",
      id: "replacement",
      params: {
        matches: { type: "damage", condition: custom("ogn-oz:noncombat-damage") },
        replace: { prevent: Number.MAX_SAFE_INTEGER },
        once: false,
      },
    },
    ...(env?.sourceObjectId ? { sourceObjectId: env.sourceObjectId } : {}),
  });
  pushEvent(context.step.events, {
    type: "replacement_created",
    playerId: controller,
    data: { effectId: id },
  });
  recordOutcome(context, [], true);
  return RESOLVED;
});

registerCardScript({
  name: "Unyielding Spirit",
  text: "[Reaction] Prevent all damage that would be dealt this turn by spells and abilities.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "custom", id: "ogn-oz:prevent-noncombat-damage-this-turn" } },
  ],
});
