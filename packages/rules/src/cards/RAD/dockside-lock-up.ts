/**
 * Dockside Lock-Up (RAD-136) — "[Deploy] When you play this, banish a unit here. When you hold
 * here, kill this to play the banished card, ignoring its cost. (Tokens aren't cards.)"
 * The two abilities are linked (the banished card is remembered for this object); the kill is the
 * hold trigger's leading cost (383.3.b, 405.2: it may be declined).
 */
import { aUnit, HERE, registerCardScript, SELF, WHEN_PLAYED, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Dockside Lock-Up",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, banish a unit here.\nWhen you hold here, kill this to play the banished card, ignoring its cost. (Tokens aren't cards.)",
  status: "partial",
  notes:
    "The banished card is played by the play op, which puts a unit at its controller's base (no location choice, 355.2 / 420.3.b).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: aUnit({ zone: HERE, targetRef: "target:0" }) },
          { op: "custom", id: "rad:link-cards", params: { ref: "target:0", key: "dockside" } },
        ],
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "cost_then",
        cost: { kill: SELF },
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "rad:bind-linked", params: { key: "dockside", as: "linked" } },
            { op: "play", target: { targetRef: "linked" }, cost: "ignored" },
          ],
        },
      },
    },
  ],
});
