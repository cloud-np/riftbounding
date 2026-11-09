/** Ivern, Friend to all. */
import { custom, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";
import { PETS } from "./custom";

registerCardScript({
  name: "Ivern, Friend to all",
  text: "As you play me, choose Bird, Cat, Dog, or Poro.\nI gain that tag.\nWhen i conquer or hold, score 1 point if your units have all of the following tags among them - Bird, Cat, Dog, and Poro.",
  status: "partial",
  notes:
    "'As you play me, choose … I gain that tag' is a play-time replacement-like choice; it is made and applied as a 'when you play me' trigger instead, so I only have the tag once that trigger resolves (355.7, 143.1).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "choose_mode",
        modes: PETS.map((tag) => ({
          id: tag.toLowerCase(),
          label: tag,
          effect: { op: "custom" as const, id: "unl:gain-tag", params: { tag } },
        })),
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["conquer", "hold"], subject: SELF } },
      effect: {
        op: "if",
        condition: custom("unl:units-have-all-tags", { tags: PETS }),
        then: { op: "score_points", amount: 1 },
      },
    },
  ],
});
