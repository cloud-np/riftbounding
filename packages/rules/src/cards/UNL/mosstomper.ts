/** Mosstomper. */
import { atLevel, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Mosstomper",
  text: "[Hunt 2] (When I conquer or hold, gain 2 XP.)\n[Level 3] I have +1[Might] and [Deflect]. (While you have 3+ XP, get the effect. Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    atLevel(3, { kind: "might", amount: 1, target: SELF }),
    atLevel(3, { kind: "keyword", keyword: "Deflect", target: SELF }),
  ],
});
