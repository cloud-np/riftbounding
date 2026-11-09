/** Card Sharp. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Card Sharp",
  text: "When you play me, you and each opponent may play a Gold gear token exhausted. For each opponent who did, you play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "custom", id: "sfd:card-sharp" } },
  ],
});
