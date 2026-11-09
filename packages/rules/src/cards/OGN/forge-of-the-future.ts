/**
 * Forge of the Future (OGN-212) — "When you play this, play a 1 [might] Recruit unit token at your
 * base. Kill this: Recycle up to 4 cards from trashes." (440.2.c; 417, owners' Main Decks 417.1.c)
 */
import { registerCardScript, SELF, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Forge of the Future",
  text: "When you play this, play a 1 [might] Recruit unit token at your base.\n\nKill this: Recycle up to 4 cards from trashes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
    },
    {
      kind: "activated",
      cost: { kill: SELF },
      effect: { op: "recycle", target: { chosen: true, zone: "trash", maxCount: 4 } },
    },
  ],
});
