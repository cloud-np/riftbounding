/**
 * Steadfast Outrider (RAD-128) — "[Tank] While there are 2 or more other friendly units and/or
 * gear at my battlefield, I have +2 [Might]."
 */
import {
  whileModifier as conditional,
  HERE,
  registerCardScript,
  SELF,
  SELF_AT_BATTLEFIELD,
} from "../sdk";
import { UNIT_OR_GEAR } from "./custom";

registerCardScript({
  name: "Steadfast Outrider",
  text: "[Tank] (I must be assigned combat damage first.)\nWhile there are 2 or more other friendly units and/or gear at my battlefield, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "and",
          conditions: [
            SELF_AT_BATTLEFIELD,
            {
              kind: "count",
              selector: {
                controller: "self",
                excludeSource: true,
                zone: HERE,
                where: UNIT_OR_GEAR,
              },
              comparison: { op: "gte", value: 2 },
            },
          ],
        },
        { kind: "might", amount: 2, target: SELF },
      ),
    },
  ],
});
