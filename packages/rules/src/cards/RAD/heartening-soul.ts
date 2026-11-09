/** Heartening Soul (RAD-040) — "When you play me, ready a friendly legend. Friendly legends have '[Tap]: Give a unit +3 [Might] this turn.'" */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Heartening Soul",
  text: 'When you play me, ready a friendly legend.\nFriendly legends have "[tap] : Give a unit +3 [might] this turn."',
  status: "partial",
  notes:
    "Granting an activated ability to friendly legends needs granted abilities (365, 801.3 for abilities).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { chosen: true, cardType: "legend", controller: "self" } },
    },
  ],
});
