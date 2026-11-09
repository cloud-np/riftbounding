/**
 * Petal Pixie (UNL-076) — "I have +1 [Might] for each of your units with [Temporary] at my
 * battlefield." A computed Might passive (479.4); "my battlefield" only exists while I am at one.
 * The catalog's [Temporary] is referenced text, not my keyword (suppressed, or 816 would kill me).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, SELF_AT_BATTLEFIELD } from "../dsl";

registerCardScript({
  name: "Petal Pixie",
  text: "I have +1 [Might] for each of your units with [Temporary] at my battlefield.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "passive",
      modifier: { kind: "while", condition: SELF_AT_BATTLEFIELD, modifier: {
            kind: "might",
            amount: {
              kind: "count",
              selector: { cardType: "unit", controller: "self", keyword: "Temporary", zone: HERE },
            },
            target: SELF,
          } },
    },
  ],
});
