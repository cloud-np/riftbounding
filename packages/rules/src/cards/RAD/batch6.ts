/**
 * Radiance (RAD) units with simple death triggers (wave R3, batch 6).
 */
import { registerCardScript } from "../registry";
import { WHEN_I_DIE, aUnit } from "../dsl";
import { UNIT_OR_GEAR } from "./dsl";

/** Demacian Illuminators (RAD-023) — "When one or more friendly units die, [buff] a friendly unit." (383.2, 810.1) */
registerCardScript({
  name: "Demacian Illuminators",
  text: "When one or more friendly units die, [buff] a friendly unit. (Give it a +1[might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "self" } },
      },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});

/**
 * Mournful Spirit (RAD-100) — "[Deathknell] You may kill a unit or gear here." (808)
 *
 * 355.7 / 808.1.d.3: the unit or gear is a Target chosen when the trigger is finalized; "here"
 * reads the leaving source's last-known location from the trigger event (383.2.c.3.b). The "you
 * may" decision is the resolution prompt of the `may` op (383.3.a).
 */
registerCardScript({
  name: "Mournful Spirit",
  text: "[Deathknell] You may kill a unit or gear here. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "may",
        effect: {
          op: "kill",
          target: { chosen: true, targetRef: "target:0", zone: { kind: "chosen", ref: "here" }, where: UNIT_OR_GEAR },
        },
      },
    },
  ],
});

/**
 * Storm Raptor (RAD-035) — "[Deflect] When a stunned enemy unit here dies, draw 1."
 *
 * 424 / 383.2.c.3.b: the die event carries the dead unit's last-known stunned status and zone, so
 * the subject matcher can read "stunned enemy unit here". [Deflect] is the engine's.
 *
 * Status stays "partial" until R4-cards flips it: `test/cards/rad/batch6.test.ts` asserts the
 * pre-fix status (lead-owned file; the trigger itself is implemented and tested in lane C).
 */
registerCardScript({
  name: "Storm Raptor",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen a stunned enemy unit here dies, draw 1.",
  status: "partial",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: {
            cardType: "unit",
            controller: "opponent",
            zone: { kind: "chosen", ref: "here" },
            stunned: true,
          },
        },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
