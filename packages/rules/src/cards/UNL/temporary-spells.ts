/**
 * Shadow's Call (UNL-165) and Turn to Dust (UNL-070) — give [Temporary] (816) without a duration
 * (801.3.a.3: it lasts while the object stays on the board). The catalog's [Temporary] on these
 * spells is referenced text, not a keyword of the spell.
 */
import { registerCardScript } from "../registry";
import { not } from "../dsl";

registerCardScript({
  name: "Shadow's Call",
  text: "Choose a friendly unit without [temporary] .\nGive it [temporary] . Draw 2. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  notes:
    "The granted [Temporary] is lost at the end of the turn by an engine bug (3d cleanup drops keywordGrants; see docs/rules/cards/unl.md).",
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

registerCardScript({
  name: "Turn to Dust",
  text: "Give a gear [Temporary] . (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  notes:
    "The granted [Temporary] is lost at the end of the turn by an engine bug (3d cleanup drops keywordGrants; see docs/rules/cards/unl.md).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "grant_keyword",
        keyword: "Temporary",
        target: { chosen: true, cardType: "gear" },
      },
    },
  ],
});
