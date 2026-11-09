/** Shadow's Call. */
import { not, registerCardScript } from "../sdk";

registerCardScript({
  name: "Shadow's Call",
  text: "Choose a friendly unit without [temporary] .\nGive it [temporary] . Draw 2. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Temporary",
            target: {
              chosen: true,
              cardType: "unit",
              controller: "self",
              where: not({
                kind: "has-keyword",
                selector: { targetRef: "it" },
                keyword: "Temporary",
              }),
            },
          },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});
