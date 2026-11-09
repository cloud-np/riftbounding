/** Allay, Eager Admirer. */
import { HERE, registerCardScript, SELF_AT_BATTLEFIELD, whilePassive as whenever } from "../sdk";

registerCardScript({
  name: "Allay, Eager Admirer",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhile I'm at a battlefield, your other units here have [Deflect].",
  status: "implemented",
  abilities: [
    whenever(SELF_AT_BATTLEFIELD, {
      kind: "keyword",
      keyword: "Deflect",
      target: { cardType: "unit", controller: "self", zone: HERE, excludeSource: true },
    }),
  ],
});
