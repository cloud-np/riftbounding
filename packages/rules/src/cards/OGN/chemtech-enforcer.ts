/**
 * Chemtech Enforcer (OGN-003) — "[ASSAULT] (+2 [Might] while I'm an attacker.) When you play me,
 * discard 1."
 *
 * The catalog text drops the keyword value but its reminder text gives +2 (the printed card is
 * [Assault 2]): the catalog's valueless Assault is suppressed and Assault 2 is stated on the card
 * (807.1.c; values are read by `effectiveKeywordValues`). Discard: 423.1.a (the player chooses).
 */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Chemtech Enforcer",
  text: "[ASSAULT] (+2 [Might] while I'm an attacker.)\nWhen you play me, discard 1.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Assault" },
    { kind: "passive", modifier: { kind: "keyword", keyword: "Assault", value: 2, target: SELF } },
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "discard", amount: 1 } },
  ],
});
