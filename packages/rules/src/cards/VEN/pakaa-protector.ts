/** Pakaa Protector. */
import { registerCardScript, SELF, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Pakaa Protector",
  text: "When I move, reveal the top card of your Main Deck. If it's a unit, draw it. Otherwise, put it in your trash and give me +2[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      // 425 reveal / 441 trash: the revealed card is the top card of the Main Deck (`looked`).
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "reveal", target: { targetRef: "looked" } },
            {
              op: "if",
              condition: {
                kind: "exists",
                selector: { targetRef: "looked", cardType: "unit", zone: "deck" },
              },
              then: { op: "draw", amount: 1 },
              else: {
                op: "seq",
                effects: [
                  { op: "burn", amount: 1, target: {} },
                  { op: "temporary_might", amount: 2, target: SELF },
                ],
              },
            },
          ],
        },
      },
    },
  ],
});
