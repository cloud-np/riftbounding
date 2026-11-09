/** Fox-Fire — kill any number of units at a battlefield with total Might 4 or less (355.13). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Fox-Fire",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].) [ACTION] (Play on your turn or in showdowns.) Kill any number of units at a battlefield with total Might 4 or less.",
  status: "manual",
  notes:
    "Not automated: a choice of any number of units constrained by a total-Might cap (no sum-constrained selector). Hidden and Action are printed keywords.",
  abilities: [],
});
