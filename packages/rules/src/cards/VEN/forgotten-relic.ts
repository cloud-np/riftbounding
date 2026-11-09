/** Forgotten Relic. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Forgotten Relic",
  text: "When you play this or at the start of your Beginning Phase, [Burn 1]. When you burn a unit this way, do this: Give a friendly unit +[Might] equal to the burned card's Might this turn. (To Burn 1, put the top card of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 1, target: {} },
          { op: "custom", id: "ven:give-burned-might" },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: {
        op: "seq",
        effects: [
          { op: "burn", amount: 1, target: {} },
          { op: "custom", id: "ven:give-burned-might" },
        ],
      },
    },
  ],
});
