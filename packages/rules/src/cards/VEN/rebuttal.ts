/** Rebuttal. */
import { registerCardScript } from "../sdk";

const REBUTTAL_SPELL = {
  chosen: true as const,
  cardType: "spell" as const,
  targetRef: "target:0",
  energyCost: { op: "lte" as const, value: 4 },
};

registerCardScript({
  name: "Rebuttal",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a spell with Energy cost no more than [4].\nYou may pay [Rune]. If you do, gain control of it and you may make new choices for it. Otherwise, counter it.",
  status: "partial",
  notes:
    "Control and the counter branch are automated. 'Make new choices' (751–755) is approximated by clearing the pending item's choices so its missing target/mode choices are re-asked at resolution: the all-at-once remake, the 753.2 negation when no legal choice exists and re-choosing a play location are not enforced.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // Zero-damage bind of the spell target (chain items are not units, so it does nothing).
          { op: "deal", amount: 0, target: REBUTTAL_SPELL },
          { op: "custom", id: "ven:rebuttal", params: { ref: "target:0" } },
        ],
      },
    },
  ],
});
