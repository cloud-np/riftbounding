/**
 * Wave R4 Vendetta legends: Empower, Action/Reaction activations and play-history triggers.
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit, custom } from "../dsl";
import { registerCustomCondition } from "../../effects/evaluate";
import { SELF_EMPOWERED, empower } from "./shared";

registerCardScript({
  name: "Akali, Rogue Assassin",
  text: "[Empower][3][Rune] ([3][Rune]: Empower me. Use only if not Empowered.)\n[Action] [Tap]: If it's your turn, move a friendly unit in a showdown to base and if I'm [Empowered] ready it.",
  status: "implemented",
  abilities: [
    empower({ energy: 3, power: { any: 1 } }),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "requires",
        condition: { kind: "is-turn-player" },
        rule: "806",
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "unit",
              selector: { cardType: "unit", controller: "self", where: custom("ven:at-showdown") },
              min: 1,
              max: 1,
              label: "Choose a friendly unit in a showdown",
            },
            { op: "move", target: { targetRef: "unit" }, to: "base" },
            {
              op: "if",
              condition: SELF_EMPOWERED,
              then: { op: "ready", target: { targetRef: "unit" } },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Kennen, Heart of the Tempest",
  text: "When you play a card from anywhere other than your hand, empower me.\n[Action] Disempower me, [Tap]: Give a unit [Assault 2] this turn. (+2 [Might] while it's an attacker.)",
  status: "partial",
  notes:
    "'Disempower me' is part of the activation cost (357.2) but the Cost shape has no disempower part, so it is paid first on resolution; the ability is rejected unless I am Empowered.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "card_played", player: "self" } },
      condition: custom("ven:played-from-not-hand"),
      effect: { op: "empower", target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "requires",
        condition: SELF_EMPOWERED,
        rule: "357.2",
        effect: {
          op: "seq",
          effects: [
            { op: "disempower", target: SELF },
            {
              op: "grant_keyword",
              keyword: "Assault", value: 2,
              target: aUnit({ targetRef: "target:0" }),
              duration: "this-turn",
            },
          ],
        },
      },
    },
  ],
});

/** The activated ability of the event's chain item cost [7] or more Energy (costSummary). */
registerCustomCondition("ven:activated-energy-7", (ctx) => {
  const itemId = ctx.env.event?.data?.itemId;
  if (typeof itemId !== "string") return false;
  const item = ctx.room.rules?.chain.find((entry) => entry.id === itemId);
  const energy = item?.totalCost?.energy ?? 0;
  return energy >= 7;
});

registerCardScript({
  name: "Nasus, Curator of the Sands",
  text: "When you play a unit, gear or activated ability with Energy cost [7] or more, you may exhaust me to ready up to 2 runes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: ["unit_played", "gear_played"],
          player: "self",
          subject: { energyCost: { op: "gte", value: 7 } },
        },
      },
      // 740.4.a.2: the leading cost is paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "ready", target: { cardType: "rune", controller: "self", maxCount: 2 } },
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "ability_activated", player: "self" } },
      condition: custom("ven:activated-energy-7"),
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "ready", target: { cardType: "rune", controller: "self", maxCount: 2 } },
      },
    },
  ],
});

registerCardScript({
  name: "Renekton, Butcher of the Sands",
  text: "[Reaction] [Rune][Rune], [Tap]: [Add] [2]. Spend this Energy only to play units or activated abilities of units.",
  status: "partial",
  notes:
    "'Spend this Energy only to play units or activated abilities of units' is a resource-spending restriction; added Energy carries no restriction (430.2).",
  abilities: [
    {
      kind: "activated",
      cost: { power: { any: 2 }, exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { energy: 2 } },
    },
  ],
});
