/** Jax, Unrelenting. */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Jax, Unrelenting",
  text: "[WEAPONMASTER] (When you play me, you may [EQUIP] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen you attach an Equipment to me, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attach", player: "self", condition: custom("sfd:attached-to-self") },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});
