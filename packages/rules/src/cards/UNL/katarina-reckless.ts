/** Katarina, Reckless. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Katarina, Reckless",
  text: "When you hide a card, ready me.\nWhen you play a card from face down, deal 2 to an enemy unit.",
  status: "partial",
  notes:
    "'When you play a card from face down, deal 2 to an enemy unit' is not automated: a unit played from facedown resolves on finalization, so by the time triggers are detected its play (and whether it came from facedown, 811.1.b) is gone; only the hide trigger is.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hide", player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});
