/** Syndra, Transcendent. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Syndra, Transcendent",
  text: "While I'm in a showdown, your spells have [Repeat] . (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    "Granting [Repeat] to spells is not implemented (820); the play layer reads Repeat from printed text only.",
  abilities: [],
});
