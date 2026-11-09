/**
 * Mageseeker Warden (OGN-070) — "While I'm at a battlefield, opponents can only play units to
 * their base. While I'm at a battlefield, spells and abilities can't ready enemy units and gear."
 *
 * The second ability is a conditional `ready` restriction (054.1, 364.3.a) — only the ready
 * instruction of spells/abilities consults it (the Awaken Phase ready is not affected). The first
 * needs a location-specific play restriction: `restrictionFor` ignores the play destination.
 */
import { registerCardScript } from "../registry";
import { SELF_AT_BATTLEFIELD } from "../dsl";

registerCardScript({
  name: "Mageseeker Warden",
  text: "While I'm at a battlefield, opponents can only play units to their base.\nWhile I'm at a battlefield, spells and abilities can't ready enemy units and gear.",
  status: "partial",
  notes:
    'Not automated: "opponents can only play units to their base" — restriction modifiers cannot depend on the play destination (restrictionFor ignores `to`, 355.2/054.1).',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: SELF_AT_BATTLEFIELD, modifier: {
            kind: "restriction",
            restriction: "ready",
            target: { cardType: "permanent", controller: "opponent" },
          } },
    },
  ],
});
