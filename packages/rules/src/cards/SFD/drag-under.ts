/** Drag Under. */
import { custom, registerCardScript, SELF, whilePassive } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Drag Under",
  text: "[Action] (Play on your turn or in showdowns.)\nI cost [2] less to play from anywhere other than your hand.\nKill a unit at a battlefield.",
  status: "implemented",
  abilities: [
    // 366.2.a: the card's own cost passive applies in the zone it is played from.
    whilePassive(custom("sfd:self-not-in-hand"), { kind: "cost", amount: -2, target: SELF }),
    { kind: "spell", effect: { op: "kill", target: target({ zone: "battlefield" }) } },
  ],
});
