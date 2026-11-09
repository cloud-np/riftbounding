/**
 * Commander Ledros (OGN-231) — [Deflect] [Ganking] (printed keywords); "As you play me, you may
 * kill any number of friendly units as an additional cost. Reduce my cost by [Order] for each
 * killed this way." A variable optional additional cost (204.2) with a per-object reduction is
 * not supported by R2-play's cost model.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Commander Ledros",
  text: "As you play me, you may kill any number of friendly units as an additional cost. Reduce my cost by [Order] for each killed this way.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Ganking] (I can move from battlefield to battlefield.)",
  status: "partial",
  notes:
    'Not automated: the optional "kill any number of friendly units" additional cost and its [Order]-per-unit reduction (204.2, 356.2.b: no variable-count additional costs). Deflect and Ganking are printed keywords.',
  abilities: [],
});
