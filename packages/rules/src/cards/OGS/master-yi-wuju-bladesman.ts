/**
 * Master Yi, Wuju Bladesman (OGS-019, legend) — "While a friendly unit defends alone, it gets +2
 * [Might]."
 *
 * A passive on friendly units with the Defender designation (323.2) that are alone (740.2.a: no
 * other friendly units at the same location).
 */
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCardScript({
  name: "Master Yi, Wuju Bladesman",
  text: "While a friendly unit defends alone, it gets +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 2,
        target: {
          cardType: "unit",
          controller: "self",
          where: {
            kind: "and",
            conditions: [custom("ogs:is-defender"), custom("alone", { ref: "it" })],
          },
        },
      },
    },
  ],
});
