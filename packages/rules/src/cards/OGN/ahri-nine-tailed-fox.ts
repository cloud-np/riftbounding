/**
 * Ahri, Nine-Tailed Fox (OGN-255, legend) — "When an enemy unit attacks a battlefield you control,
 * give it -1 [Might] this turn, to a minimum of 1 [Might]." (383.4.e; 479.4.b snapshot)
 *
 * "a battlefield you control" is part of the trigger condition (383.2.a.1): the battlefield of the
 * attack event is controlled by Ahri's controller (190.2, stored control).
 */
import type { Condition } from "@rift/protocol";
import { controlsBattlefield, EVENT_SUBJECT, registerCardScript, registerCustomCondition } from "../sdk";

/** The trigger event happened at a battlefield the ability's controller controls (190.2). */
registerCustomCondition("ogn-an:event-battlefield-yours", (ctx) => {
  const zone = ctx.env.event?.zone;
  if (!zone || !(ctx.host.battlefieldZones(ctx.room) as string[]).includes(zone)) return false;
  return controlsBattlefield(ctx.room, ctx.env.controller, zone, ctx.host);
});

export const EVENT_BATTLEFIELD_YOURS: Condition = {
  kind: "custom",
  id: "ogn-an:event-battlefield-yours",
};

registerCardScript({
  name: "Ahri, Nine-Tailed Fox",
  text: "When an enemy unit attacks a battlefield you control, give it -1 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "attack",
          subject: { cardType: "unit", controller: "opponent" },
          condition: EVENT_BATTLEFIELD_YOURS,
        },
      },
      effect: { op: "give_might", amount: -1, min: 1, target: EVENT_SUBJECT },
    },
  ],
});
