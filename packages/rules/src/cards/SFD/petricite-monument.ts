/** Petricite Monument. */
import { notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Petricite Monument",
  text: "[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nFriendly units have [Deflect]. (Opponents must pay [Rune] to choose them with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Deflect",
        target: { cardType: "unit", controller: "self" },
      },
    },
  ],
});
