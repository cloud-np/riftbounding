/**
 * Wielder of Water (OGN-055) — "While I'm attacking or defending alone, I have +2 [Might]."
 *
 * Registers `ogn-oz:self-in-combat`: the source holds an attacker or defender designation
 * (323.2 / 740.2.c). "Alone" (740.2.a): no other friendly unit at my location (built-in `alone`).
 */
import { registerCustomCondition } from "../../effects/evaluate";
import { registerCardScript } from "../registry";
import { SELF, custom } from "../dsl";

registerCustomCondition("ogn-oz:self-in-combat", (ctx) => {
  const source = ctx.env.sourceObjectId;
  const designation = source ? ctx.room.rules?.objects[source]?.designation : undefined;
  return designation === "attacker" || designation === "defender";
});

registerCardScript({
  name: "Wielder of Water",
  text: "While I'm attacking or defending alone, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "conditional",
        params: {
          condition: {
            kind: "and",
            conditions: [custom("ogn-oz:self-in-combat"), custom("alone", { ref: "self" })],
          },
          modifier: { kind: "might", amount: 2, target: SELF },
        },
      },
    },
  ],
});
