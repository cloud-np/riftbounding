/**
 * Bilgewater Bully (OGN-125) — "While I'm buffed, I have [GANKING]." (364.3.a conditional passive;
 * the catalog's Ganking is the conditional one, not intrinsic, 727.1.b-style)
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Bilgewater Bully",
  text: "While I'm buffed, I have [GANKING]. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    {
      kind: "passive",
      modifier: { kind: "while", condition: { kind: "self-state", state: "buffed" }, modifier: { kind: "keyword", keyword: "Ganking", target: SELF } },
    },
  ],
});
