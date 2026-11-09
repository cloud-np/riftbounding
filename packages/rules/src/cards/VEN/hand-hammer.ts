/** Hand Hammer. */
import { whilePassive as conditional, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Hand Hammer",
  text: "[Equip][Calm] ([Calm]: Attach this to a unit you control.)\nI have +2 [Might] while I'm at a battlefield with exactly one other unit you control.\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 718.4: effect text of an attached Equipment applies to the unit it is attached to.
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
    conditional(custom("ven:exactly-one-other-friendly-here", { host: true, battlefield: true }), {
      kind: "might",
      amount: 2,
      target: { targetRef: "host" },
    }),
  ],
});
