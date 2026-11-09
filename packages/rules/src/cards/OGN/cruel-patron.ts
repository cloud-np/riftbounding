/**
 * Cruel Patron (OGN-208) — "As an additional cost to play me, kill a friendly unit."
 * A mandatory printed additional cost (204.2, 356.2) parsed and paid by R2-play (357.2: forced
 * when one candidate, chosen otherwise; unplayable without one, 203.3).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Cruel Patron",
  text: "As an additional cost to play me, kill a friendly unit.",
  status: "implemented",
  abilities: [],
});
