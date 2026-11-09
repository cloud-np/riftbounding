/** Watchful Curator (RAD-037) — "Your gear have [Deflect]." (809, 801.3) It has no Deflect itself. */
import { notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Watchful Curator",
  text: "Your gear have [Deflect]. (Opponents must pay [Rune] to choose each with a spell or ability.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deflect"),
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Deflect",
        target: { cardType: "gear", controller: "self" },
      },
    },
  ],
});
