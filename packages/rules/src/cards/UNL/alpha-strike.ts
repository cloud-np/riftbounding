/** Alpha Strike. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Alpha Strike",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a friendly unit. It deals damage equal to its Might split among enemy units at battlefields.\nThen for each unit this kills, do this: Gain 1 XP.",
  status: "partial",
  notes:
    'The split damage is automated (355.14). "For each unit this kills" is read as each affected unit left with lethal damage when the spell resolves: deaths happen in the following Cleanup, so a death replaced by another effect still gains the XP (730.1).',
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal_split",
            amount: { kind: "might", selector: { targetRef: "friend" } },
            source: { chosen: true, targetRef: "friend", cardType: "unit", controller: "self" },
            target: {
              chosen: true,
              targetRef: "foes",
              cardType: "unit",
              controller: "opponent",
              zone: "battlefield",
            },
          },
          // "for each unit this kills" (730.1): the split's affected units with lethal damage.
          { op: "custom", id: "unl:xp-per-kill" },
        ],
      },
    },
  ],
});
