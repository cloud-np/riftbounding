/**
 * Bilgewater Bully (OGN-125) — "While I'm buffed, I have [GANKING]." (364.3.a conditional passive;
 * the catalog's Ganking is the conditional one, not intrinsic, 727.1.b-style)
 */
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

registerCardScript({
  name: "Bilgewater Bully",
  text: "While I'm buffed, I have [GANKING]. (I can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "conditional",
        params: {
          condition: custom("self-buffed"),
          modifier: { kind: "keyword", keyword: "Ganking", target: SELF },
        },
      },
    },
  ],
});
