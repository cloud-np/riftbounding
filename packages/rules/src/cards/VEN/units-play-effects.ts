/**
 * Vendetta units whose abilities are play effects (383.4.a), "when you play" triggers (420.4.a)
 * or simple keyword text.
 */
import { aUnit, notIntrinsic, registerCardScript, SELF, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Cloud Drake",
  text: "When you play me, draw 1.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } }],
});

registerCardScript({
  name: "Field Musicians",
  text: "When you play me, give a unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit() },
    },
  ],
});

registerCardScript({
  name: "Reluctant Leader",
  text: "When you play another unit, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 420.4.a / 440.2.c: when another unit you play (tokens included) has been played.
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          player: "self",
          subject: { cardType: "unit", excludeSource: true },
        },
      },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Patched Porobot",
  text: "(I enter exhausted.)\nWhen you play me, if you control 3 or more other gear, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      // 383.2.a.1: the "if" is part of the trigger condition. I'm a Unit Gear (I count as gear).
      condition: {
        kind: "count",
        selector: { cardType: "gear", controller: "self", excludeSource: true },
        comparison: { op: "gte", value: 3 },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

registerCardScript({
  name: "Morgana, Vindictive",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, deal damage to a unit equal to the damage marked on it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      // 418 / 142: the amount is the damage marked on the chosen unit when this resolves.
      effect: {
        op: "deal",
        amount: { kind: "damage", selector: { targetRef: "target:0" } },
        target: aUnit({ targetRef: "target:0" }),
      },
    },
    ...notIntrinsic("Reaction"),
  ],
});

registerCardScript({
  name: "Illaoi, Prophet of the Great Kraken",
  text: "When you play me or when I score, play a 1 [Might] Tentacle unit token from Bilgewater.\nI have +1 [Might] for each token unit you control.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Tentacle", { might: 1, play: true }) },
    },
    {
      kind: "triggered",
      // 383.4.c / 383.4.d: I score when my controller conquers or holds with me there.
      trigger: { kind: "event", event: { type: ["conquer", "hold"], subject: SELF } },
      effect: { op: "create", token: token("Tentacle", { might: 1, play: true }) },
    },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: { kind: "count", selector: { cardType: "unit", controller: "self", token: true } },
        target: SELF,
      },
    },
  ],
});

registerCardScript({
  name: "Horns of the Dragon",
  text: "[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: [],
});

registerCardScript({
  name: "Soulspinner",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)",
  status: "implemented",
  abilities: [...notIntrinsic("Reaction")],
});
