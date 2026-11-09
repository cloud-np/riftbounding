/**
 * Guerilla Warfare (OGN-264) — "Return up to two cards with [HIDDEN] from your trash to your hand.
 * You can hide ignoring costs this turn."
 * The return is automated (355.13 "up to"). Hiding is R2-play's discretionary action (422/811);
 * there is no hook for "hide ignoring costs this turn".
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Guerilla Warfare",
  text: "Return up to two cards with [HIDDEN]  from your trash to your hand. You can hide ignoring costs this turn.",
  status: "partial",
  notes:
    'Not automated: "You can hide ignoring costs this turn" — no effect hook for the Hide cost (422, 811.1.a).',
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Hidden" },
    {
      kind: "spell",
      effect: {
        op: "return_to_hand",
        target: { chosen: true, zone: "trash", owner: "self", keyword: "Hidden", maxCount: 2 },
      },
    },
  ],
});
