/**
 * Brazen Buccaneer (OGN-002) — "As you play me, you may discard a card as an additional cost. If
 * you do, reduce my cost by [2]." R2-play parses and pays the optional discard (204.2, 423.3);
 * the conditional reduction (356.2.b.1) cannot be expressed: `costAdjustments` ignores which
 * optional costs the play chose.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Brazen Buccaneer",
  text: "As you play me, you may discard a card as an additional cost. If you do, reduce my cost by [2].",
  status: "partial",
  notes:
    'Not automated: "If you do, reduce my cost by [2]" — costAdjustments does not see the optional costs paid for the play (356.2.b.1). The optional discard itself is parsed and paid by R2-play.',
  abilities: [],
});
