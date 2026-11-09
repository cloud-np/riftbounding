/** Starhound. */
import { custom, registerCardScript, WHEN_PLAYED } from "../sdk";
import { PETS } from "./custom";

registerCardScript({
  name: "Starhound",
  text: "When you play me, return a Bird, Cat, Dog, or Poro from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: {
          chosen: true,
          zone: "trash",
          controller: "self",
          where: custom("unl:it-has-any-tag", { tags: PETS }),
        },
      },
    },
  ],
});
