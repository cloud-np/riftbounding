/**
 * Detonation Amplifier (RAD-017) — "[Deploy] When you play this, you may kill another friendly unit
 * or gear to draw 1. Friendly [Deathknell] effects here trigger an additional time."
 */
import { notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";
import { UNIT_OR_GEAR } from "./custom";

registerCardScript({
  name: "Detonation Amplifier",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may kill another friendly unit or gear to draw 1.\nFriendly [Deathknell] effects here trigger an additional time.",
  status: "partial",
  notes:
    '"Friendly [Deathknell] effects here trigger an additional time" needs trigger-count modification (808, 383).',
  abilities: [
    ...notIntrinsic("Deathknell"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "victim",
              selector: { controller: "self", excludeSource: true, where: UNIT_OR_GEAR },
            },
            { op: "kill", target: { targetRef: "victim" } },
            { op: "if", condition: { kind: "did" }, then: { op: "draw", amount: 1 } },
          ],
        },
      },
    },
  ],
});
