/**
 * Vendetta battlefields (053.3: "here" is the battlefield itself; battlefield abilities act for
 * the event's player, "When you hold/conquer here").
 */
import { runesControlled } from "./shared";
import { HERE, registerCardScript, WHEN_YOU_CONQUER_HERE, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Shadow Temple",
  text: "When you hold here, [burn 3]. (Put the top 3 cards of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "burn", amount: 3, target: {} },
    },
  ],
});

registerCardScript({
  name: "Protective Sands",
  text: "When you conquer here, if you control 4 or fewer runes, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      condition: runesControlled("lte", 4),
      // 740.4.a.2: a leading cost within instructions, paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Threshold of the Gray",
  text: "When combat starts here, the attacker and defender each [add] [1].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 466.2: the combat_begin event names the battlefield and both players.
      trigger: { kind: "event", event: { type: "combat_begin", zone: HERE } },
      effect: { op: "custom", id: "ven:combatants-add", params: { energy: 1 } },
    },
  ],
});
