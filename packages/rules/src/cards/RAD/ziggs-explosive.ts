/**
 * Ziggs, Explosive (RAD-112) — "[1], [Tap]: Play a Bomb gear token to a battlefield. When I defend,
 * you may kill a friendly gear to give me +2 [Might] this turn."
 */
import { registerCardScript, SELF } from "../sdk";
import { playBombs } from "./custom";

registerCardScript({
  name: "Ziggs, Explosive",
  text: "[1], [Tap]: Play a Bomb gear token to a battlefield. (It has [Deploy]. When it dies, deal 2 to an enemy there and kill your other Bombs there.)\nWhen I defend, you may kill a friendly gear to give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "activated", cost: { energy: 1, exhaust: SELF }, effect: playBombs(1) },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "defend", subject: SELF } },
      effect: {
        op: "may",
        effect: {
          op: "seq",
          effects: [
            { op: "choose", key: "victim", selector: { cardType: "gear", controller: "self" } },
            { op: "kill", target: { targetRef: "victim" } },
            {
              op: "if",
              condition: { kind: "did" },
              then: { op: "temporary_might", amount: 2, target: SELF },
            },
          ],
        },
      },
    },
  ],
});
