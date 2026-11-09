/**
 * Scrapheap (OGN-182) — "When this is played, discarded, or killed, draw 1."
 *
 * Played (420.4.a, `gear_played`) and killed (383.2.c.3, the object's own leave-the-board trigger)
 * are automated. Partial: "discarded" triggers from the hand (a non-board zone, 385), and
 * triggered abilities of cards outside the board are not detected.
 */
import { registerCardScript, WHEN_I_DIE, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Scrapheap",
  text: "When this is played, discarded, or killed, draw 1.",
  status: "partial",
  notes:
    "The 'discarded' trigger is manual: triggers of cards in non-board zones (385) are not detected.",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    { kind: "triggered", trigger: WHEN_I_DIE, effect: { op: "draw", amount: 1 } },
  ],
});
