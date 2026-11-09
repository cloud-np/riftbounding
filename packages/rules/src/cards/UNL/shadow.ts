/** Shadow. */
import {
  aUnit,
  custom,
  HERE,
  registerCardScript,
  SELF,
  SELF_AT_BATTLEFIELD,
  whilePassive as whenever,
} from "../sdk";

registerCardScript({
  name: "Shadow",
  text: "If you play me to a battlefield, I enter ready.\n[Action] [1][Rune], [Tap]: [Stun] an enemy unit attacking here. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Action" },
    whenever(SELF_AT_BATTLEFIELD, { kind: "enter-ready", target: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, power: { any: 1 }, exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "stun",
        target: aUnit({ controller: "opponent", zone: HERE, where: custom("core:attacking") }),
      },
    },
  ],
});
