/** Turn to Dust. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Turn to Dust",
  text: "Give a gear [Temporary] . (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
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
