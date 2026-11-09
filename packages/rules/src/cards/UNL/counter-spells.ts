/**
 * Unleashed counterspells (426): Abandon (counter, the card returns to its owner's hand instead of
 * the trash, then [Predict] 437), Lilting Lullaby (counter; its controller can't play spells this
 * turn), Flurry of Feathers (choose one, 355.3: counter a spell, or play four 1 [Might] Bird
 * tokens — the token's [Deflect] comes from the catalog token).
 */
import { registerCardScript, token } from "../sdk";

const A_SPELL = { chosen: true, cardType: "spell" } as const;

registerCardScript({
  name: "Abandon",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell. Return it to its owner's hand instead of putting it in their trash.\n[Predict] . (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: { ...A_SPELL },
            effect: { op: "custom", id: "unl:counter-to-hand" },
          },
          { op: "predict", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Lilting Lullaby",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell. Its controller can't play spells this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { ...A_SPELL },
        effect: {
          op: "seq",
          effects: [
            // Read the spell's controller before it leaves the chain.
            { op: "custom", id: "unl:no-spells-this-turn" },
            { op: "counter", target: { targetRef: "it" } },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Flurry of Feathers",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose one —\n• Counter a spell.\n• Play four 1 [Might] Bird unit tokens with [Deflect]. (Opponents must pay [Rune] to choose them with a spell or ability.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "counter",
            label: "Counter a spell",
            effect: { op: "counter", target: { ...A_SPELL } },
          },
          {
            id: "birds",
            label: "Play four Birds",
            effect: { op: "create", token: token("Bird", { count: 4, might: 1, play: true }) },
          },
        ],
      },
    },
  ],
});
