/** Void Drone. */
import { custom, registerCardScript, SELF, whilePassive } from "../sdk";

registerCardScript({
  name: "Void Drone",
  text: "I cost [2] less to play from anywhere other than your hand.",
  status: "implemented",
  abilities: [
    whilePassive(custom("sfd:self-not-in-hand"), { kind: "cost", amount: -2, target: SELF }),
  ],
});
