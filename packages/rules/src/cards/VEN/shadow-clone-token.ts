/**
 * Shadow Clone unit token (VEN-T05, created by Zed, From the Shadows / Zed, Without a Sound /
 * Death Mark) — "When I attack, you may banish a unit from your trash. If you do, give me
 * [Assault 4] this turn."
 *
 * 383.3.a: "you may" is decided when the trigger finalizes; "if you do" reads the banish
 * (359.3.e.14.b). The catalog's Assault (value 4 from the text) is only granted by the trigger
 * (727.1.b). Kept in the Vendetta folder because only this lane's cards create it.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { WHEN_I_ATTACK, notIntrinsic } from "./shared";

registerCardScript({
  name: "Shadow Clone",
  text: "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn. (+4 [Might] while I'm an attacker.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "banished",
            selector: { zone: "trash", owner: "self", cardType: "unit" },
            min: 1,
            max: 1,
            label: "Banish a unit from your trash",
          },
          { op: "banish", target: { targetRef: "banished" } },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "grant_keyword",
              keyword: "Assault", value: 4,
              target: SELF,
              duration: "this-turn",
            },
          },
        ],
      },
    },
  ],
});
