/**
 * Unleashed units with "When I move" triggers (421, 447–455; the move event's zone is the
 * destination and `data.from` the origin):
 *
 * - Nilah, Joyful Ascetic (UNL-115): [Accelerate], [Ganking]; When I move, gain 1 XP.
 * - Mister Root (UNL-127): [Accelerate]; When I move to a battlefield, gain 2 XP.
 * - Irresistible Faefolk (UNL-112): When I move to a battlefield, you may move an enemy unit to
 *   that battlefield.
 * - Imposing Challenger (UNL-105): When I move, you may move an enemy unit here with less Might
 *   than me to a different battlefield (355.4.a: never to its own location).
 * - Lillia, Fae Fawn (UNL-082): [Accelerate]; When I move from a location, play a 3 [Might]
 *   Sprite there (enters exhausted, 143.4; [Temporary] from the catalog token; the catalog's
 *   [Temporary] on Lillia is suppressed).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, WHEN_I_MOVE, aUnit, custom, token } from "../dsl";

const MOVED_TO_BATTLEFIELD = custom("event-zone-is", { battlefield: true });

registerCardScript({
  name: "Nilah, Joyful Ascetic",
  text: "[Accelerate] (You may pay [1][Body] as an additional cost to have me enter ready.)\n[Ganking] (I can move from battlefield to battlefield.)\nWhen I move, gain 1 XP.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_MOVE, effect: { op: "gain_xp", amount: 1 } }],
});

registerCardScript({
  name: "Mister Root",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nWhen I move to a battlefield, gain 2 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: MOVED_TO_BATTLEFIELD,
      effect: { op: "gain_xp", amount: 2 },
    },
  ],
});

registerCardScript({
  name: "Irresistible Faefolk",
  text: "When I move to a battlefield, you may move an enemy unit to that battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: MOVED_TO_BATTLEFIELD,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "opponent" }),
          to: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Imposing Challenger",
  text: "When I move, you may move an enemy unit here with less Might than me to a different battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({
            controller: "opponent",
            zone: HERE,
            might: { op: "lt", value: { kind: "might", selector: SELF } },
          }),
          to: "battlefield",
        },
      },
    },
  ],
});

registerCardScript({
  name: "Lillia, Fae Fawn",
  text: "[Accelerate] (You may pay [1][Mind] as an additional cost to have me enter ready.)\nWhen I move from a location, play a 3 [Might] Sprite unit token with [Temporary] there. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Temporary", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, play: true }),
        zone: { kind: "chosen", ref: "event-from" },
      },
    },
  ],
});
