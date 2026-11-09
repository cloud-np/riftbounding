/**
 * Lillia, Protector of Dreams (UNL-058) — "When you play a token unit, give me +1 [Might] this
 * turn." (440.2.c: a played token is `unit_played` with `data.token`) and "Your token units have
 * [Tank]" (365.1 passive). The catalog's [Tank] is the granted one, not mine (suppressed).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Lillia, Protector of Dreams",
  text: "When you play a token unit, give me +1[Might] this turn.\nYour token units have [Tank]",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Tank" },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "unit_played", player: "self", data: { token: true } },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Tank",
        target: { cardType: "unit", controller: "self", token: true },
      },
    },
  ],
});
