/**
 * Recruit the Vanguard (OGS-015) — "[ACTION] Play four 1 [Might] Recruit unit tokens. (They can be
 * played to your base or to battlefields you control.)"
 *
 * 440.2.c / 182: four Recruit tokens are played. The tokens are played to the base; choosing a
 * battlefield you control for each token (440.2.b.1) is not offered.
 */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Recruit the Vanguard",
  text: "[ACTION] (Play on your turn or in showdowns.)\nPlay four 1 [Might] Recruit unit tokens. (They can be played to your base or to battlefields you control.)",
  status: "partial",
  notes:
    "Token locations are not chosen: the four tokens are played to the base; `create` takes one zone and the 355.4 location choice offers no 'battlefields you control' filter (440.2.b.1).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "create",
        token: token("Recruit", { count: 4, might: 1, play: true }),
        zone: "base",
      },
    },
  ],
});
