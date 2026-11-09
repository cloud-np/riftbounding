/**
 * Bomb gear token (RAD-T02, rule 187) — "[Deploy] (Play this only to a battlefield. When an
 * opponent holds here, kill this.) [Deathknell] Deal 2 to an enemy unit here and kill all other
 * Bombs you control here."
 *
 * Deploy is an engine keyword trigger (830.1.b). Deathknell is the token's own `die` trigger
 * (808.1.c): "here" is the token's last-known location from the kill event (383.2.c.3.b), so the
 * target choice and the other-Bombs instruction use the "event-zone" reference (359.3.f.2).
 * [Deploy] is printed Rules Text on the token; it is not an attached card, so 718.2 does not
 * apply.
 */
import { registerCardScript } from "../sdk";

const EVENT_ZONE = { kind: "chosen", ref: "event-zone" } as const;

registerCardScript({
  name: "Bomb",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\n[Deathknell] Deal 2 to an enemy unit here and kill all other Bombs you control here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { targetRef: "self" } },
      },
      keywords: ["Deathknell"],
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 2,
            target: {
              chosen: true,
              targetRef: "target:0",
              cardType: "unit",
              controller: "opponent",
              zone: EVENT_ZONE,
            },
          },
          {
            op: "kill",
            target: { name: "Bomb", controller: "self", zone: EVENT_ZONE },
          },
        ],
      },
    },
  ],
});
