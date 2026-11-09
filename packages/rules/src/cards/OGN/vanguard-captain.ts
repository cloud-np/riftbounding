/**
 * Vanguard Captain (OGN-218) — "[LEGION] - When you play me, play two 1 [Might] Recruit unit
 * token here." (812 Legion; 440.2.c "play a token"; "here" = my location, 359.3.f)
 */
import { LEGION } from "./trifarian-gloryseeker";
import { HERE, registerCardScript, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Vanguard Captain",
  text: "[LEGION] - When you play me, play two 1 [Might] Recruit unit token here. (Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: LEGION,
      keywords: ["Legion"],
      effect: {
        op: "create",
        token: token("Recruit", { might: 1, count: 2, play: true }),
        zone: HERE,
      },
    },
  ],
});
