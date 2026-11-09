/**
 * Janna, Savior (SFD-053, Spiritforged errata) — "[Reaction] When you play me, heal your units
 * here, then move up to one enemy unit from here to its base."
 *
 * [Reaction] is printed (R2-play). The play effect (383.4.a) heals all friendly units at Janna's
 * location (419) and then moves zero or one chosen enemy unit there to its base (355.13, 421).
 */
import { registerCardScript } from "../registry";
import { aUnit, HERE, WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Janna, Savior",
  text: "[Reaction] (Play any time, even before spells and abilities resolve, including to a battlefield you control.)\nWhen you play me, heal your units here, then move up to one enemy unit from here to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "heal",
            amount: 99,
            target: { controller: "self", cardType: "unit", zone: HERE },
          },
          {
            op: "move",
            target: aUnit({ controller: "opponent", zone: HERE, maxCount: 1 }),
            to: "base",
          },
        ],
      },
    },
  ],
});
