/**
 * Lee Sin, Ascetic (OGN-078) — "[SHIELD] [Tap]: Buff me. I can have any number of buffs."
 *
 * The [Tap] ability is automated; "I can have any number of buffs" overrides the one-buff limit
 * (427.1.b / 702.3), which the `buff` op always enforces — so only the first buff is placed.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Lee Sin, Ascetic",
  text: "[SHIELD] (+1 [Might] while I'm a defender.)\n[Tap]: Buff me. (I get a +1 [Might] buff.) \nI can have any number of buffs.",
  status: "partial",
  notes:
    'Not automated: "I can have any number of buffs" — the buff op always applies the one-buff limit (427.1.b.1; 427.1.b.2 permits more), so a second buff does nothing.',
  abilities: [{ kind: "activated", cost: { exhaust: SELF }, effect: { op: "buff", target: SELF } }],
});
