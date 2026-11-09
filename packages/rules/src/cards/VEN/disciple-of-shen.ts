/** Disciple of Shen. */
import {
  whilePassive as conditional,
  custom,
  notIntrinsic,
  registerCardScript,
  SELF,
} from "../sdk";

registerCardScript({
  name: "Disciple of Shen",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nI have [Shield 3] while I'm at a battlefield with exactly one other unit you control. (+3 [Might] while I'm a defender.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    conditional(custom("ven:exactly-one-other-friendly-here", { battlefield: true }), {
      kind: "keyword",
      keyword: "Shield",
      value: 3,
      target: SELF,
    }),
  ],
});
