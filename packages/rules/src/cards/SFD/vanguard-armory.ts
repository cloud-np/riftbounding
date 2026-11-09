/** Vanguard Armory. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Vanguard Armory",
  text: "[Tap]: Play three 1 [Might] Recruit unit tokens. (You may play them to different locations.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "custom", id: "sfd:recruits-anywhere", params: { count: 3, token: "Recruit" } },
    },
  ],
});
