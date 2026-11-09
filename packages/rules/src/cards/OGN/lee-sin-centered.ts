/**
 * Lee Sin, Centered (OGN-151) — [Accelerate] (805, R2-play); "Other buffed friendly units at my
 * battlefield have +2 [Might]." (364.3.a: only while Lee Sin is at a battlefield)
 */
import { registerCardScript } from "../registry";
import { HERE, SELF_AT_BATTLEFIELD } from "../dsl";

registerCardScript({
  name: "Lee Sin, Centered",
  text: "[Accelerate] (You may pay [1][Body] as an additional cost to have me enter ready.)\nOther buffed friendly units at my battlefield have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: SELF_AT_BATTLEFIELD, modifier: {
            kind: "might",
            amount: 2,
            target: {
              cardType: "unit",
              controller: "self",
              excludeSource: true,
              buffed: true,
              zone: HERE,
            },
          } },
    },
  ],
});
