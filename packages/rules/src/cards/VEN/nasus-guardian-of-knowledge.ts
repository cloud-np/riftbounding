/** Nasus, Guardian of Knowledge. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Nasus, Guardian of Knowledge",
  text: "Once each turn, when an enemy unit here dies, channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // The kill event's zone is where the unit died (383.2.c.3.b noted information).
      trigger: {
        kind: "event",
        event: { type: "die", zone: HERE, subject: { cardType: "unit", controller: "opponent" } },
      },
      limit: { kind: "once-per-turn" },
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});
