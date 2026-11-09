/** Lingering Animus (RAD-005) — "I enter ready if a friendly unit or gear died this turn." */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Lingering Animus",
  text: "I enter ready if a friendly unit or gear died this turn.",
  status: "manual",
  notes:
    "No per-turn record of units/gear that died exists (383.2.c, 369.3), so the conditional entry replacement cannot be evaluated.",
  abilities: [],
});
