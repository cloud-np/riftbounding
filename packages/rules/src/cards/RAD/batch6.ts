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

/** Mournful Spirit (RAD-100) — "[Deathknell] You may kill a unit or gear here." (808) */
registerCardScript({
  name: "Mournful Spirit",
  text: "[Deathknell] You may kill a unit or gear here. (When I die, get the effect.)",
  status: "partial",
  notes:
    "The unit or gear is chosen on resolution, not as a Target when the trigger is put on the chain (355.7): the choice-scan environment of a leaving object's Deathknell has no event/last-known location (see [BUG] in bugs.test.ts), so it can't be a chosen target and Deflect/targeting restrictions don't apply.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "victim",
              selector: { zone: { kind: "chosen", ref: "event-zone" }, where: UNIT_OR_GEAR },
            },
            { op: "kill", target: { targetRef: "victim" } },
          ],
        },
      },
    },
  ],
});

/**
 * Storm Raptor (RAD-035) — "[Deflect] When a stunned enemy unit here dies, draw 1." The die event
 * carries neither the dead unit's stunned status (424) nor its object state, so the "stunned"
 * condition can't be checked; a trigger without it would draw for every enemy death (not scripted).
 */
registerCardScript({
  name: "Storm Raptor",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhen a stunned enemy unit here dies, draw 1.",
  status: "partial",
  notes:
    '"When a stunned enemy unit here dies" is not automated: the die event has no last-known stunned status (424, 383.2.c.3); [Deflect] is the engine\'s.',
  abilities: [],
});
