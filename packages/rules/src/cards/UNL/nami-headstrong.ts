/** Nami, Headstrong. */
import {
  aUnit,
  EVENT_SUBJECT,
  PAID_ADDITIONAL,
  registerCardScript,
  WHEN_I_HOLD,
  WHEN_PLAYED,
} from "../sdk";

registerCardScript({
  name: "Nami, Headstrong",
  text: "You may pay [Calm] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, [Stun] an enemy unit. (It doesn't deal combat damage this turn.)\nWhen I hold, the next time you play a unit this turn, ready it and [Buff] it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "stun", target: aUnit({ controller: "opponent" }) },
    },
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
        effect: {
          op: "seq",
          effects: [
            { op: "ready", target: EVENT_SUBJECT },
            { op: "buff", target: EVENT_SUBJECT },
          ],
        },
        once: true,
        duration: "this-turn",
      },
    },
  ],
});
