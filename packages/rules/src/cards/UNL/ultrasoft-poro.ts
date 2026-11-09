/** Ultrasoft Poro (UNL-160 — EX[156] (377.2.b). [Deflect] on the Birds is R2-play's keyword.) */
import { registerCardScript, SELF, SELF_AT_BATTLEFIELD, token } from "../sdk";

registerCardScript({
  name: "Ultrasoft Poro",
  text: "[Tap]: Play two 1[Might] Bird unit tokens with [deflect].\nUse this ability only while I'm at a battlefield.\n(Opponents must pay [Rune] to choose a [Deflect] unit with a spell or ability.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "requires",
        condition: SELF_AT_BATTLEFIELD,
        effect: {
          op: "create",
          token: token("Bird", { count: 2, might: 1, keywords: ["Deflect"], play: true }),
        },
      },
    },
  ],
});
