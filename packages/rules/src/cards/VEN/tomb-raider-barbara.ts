/**
 * Tomb-Raider Barbara (VEN-037) — "When you play me, if you control 7 or more runes, choose an
 * enemy gear. If it's [Empowered], disempower it. Otherwise, kill it."
 *
 * 383.2.a.1: the "if" right after the trigger condition is part of it (checked when played);
 * the Empowered check is made on resolution (359.3.f.2).
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";
import { runesControlled } from "./shared";

const GEAR = {
  chosen: true,
  cardType: "gear" as const,
  controller: "opponent" as const,
  targetRef: "target:0",
};

registerCardScript({
  name: "Tomb-Raider Barbara",
  text: "When you play me, if you control 7 or more runes, choose an enemy gear. If it's [Empowered], disempower it. Otherwise, kill it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: runesControlled("gte", 7),
      effect: {
        op: "if",
        condition: { kind: "exists", selector: { targetRef: "target:0", empowered: true } },
        then: { op: "disempower", target: GEAR },
        else: { op: "kill", target: GEAR },
      },
    },
  ],
});
