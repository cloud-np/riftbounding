/** Encore (RAD-152) — "Choose two —" of four modes. See the status note for the timing deviation. */
import { aUnit, registerCardScript, token } from "../sdk";
import { drawCard } from "./custom";

const LOOKED = { kind: "in-ref", ref: "looked" };

const ENCORE_MODES = [
  {
    id: "deal",
    label: "Deal 2 to a unit",
    effect: { op: "deal" as const, amount: 2, target: aUnit() },
  },
  {
    id: "tokens",
    label: "Play two 1 Might Recruit unit tokens",
    effect: {
      op: "create" as const,
      token: token("Recruit", { count: 2, might: 1, play: true }),
      zone: "base" as const,
    },
  },
  {
    id: "might",
    label: "Give up to two units each +1 Might this turn",
    effect: { op: "temporary_might" as const, amount: 1, target: aUnit({ maxCount: 2 }) },
  },
  {
    id: "look",
    label: "Look at the top 2, draw 1 and recycle the other",
    effect: {
      op: "look" as const,
      amount: 2,
      then: {
        op: "seq" as const,
        effects: [
          {
            op: "choose" as const,
            key: "drawn",
            selector: { zone: "deck" as const, controller: "self" as const, where: LOOKED },
            min: 0,
            max: 1,
          },
          drawCard("drawn"),
          {
            op: "recycle" as const,
            target: {
              zone: "deck" as const,
              controller: "self" as const,
              where: LOOKED,
              excludeRefs: ["drawn"],
            },
          },
        ],
      },
    },
  },
];

registerCardScript({
  name: "Encore",
  text: "Choose two —\n • Deal 2 to a unit.\n • Play two 1 [might] Recruit unit tokens.\n • Give up to two units each +1 [might] this turn.\n • Look at the top 2 cards of your Main Deck, draw 1 and recycle the other.",
  status: "partial",
  notes:
    "All four modes are automated, but the two modes (and any targets) are chosen on resolution instead of when the spell is played: the engine's `choose_mode` play-time choice asks exactly one mode (355.3, 355.8).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "custom",
        id: "rad:choose-modes",
        params: {
          modes: ENCORE_MODES,
          min: 2,
          max: 2,
          rule: "355.3",
          promptKey: "rules.prompt.chooseModes",
        },
      },
    },
  ],
});
