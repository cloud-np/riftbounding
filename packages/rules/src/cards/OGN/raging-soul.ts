/**
 * Raging Soul (OGN-019) — "If you've discarded a card this turn, I have [ASSAULT] and [GANKING]."
 *
 * Manual: the condition needs a per-turn history of discards (423), which the rules state does not
 * record. The catalog lists [Assault]/[Ganking] as printed keywords, so until the condition can be
 * evaluated the card keeps them (players police the condition).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Raging Soul",
  text: "If you've discarded a card this turn, I have [ASSAULT] and [GANKING]. (+1 [MIGHT] while I'm an attacker. I can move from battlefield to battlefield)",
  status: "manual",
  notes:
    "Needs a per-turn discard history (423) for its conditional keywords (727.1.b); none is recorded.",
  abilities: [],
});
