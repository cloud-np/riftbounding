/** Factory Recall. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Factory Recall",
  text: "[Action] (Play on your turn or in showdowns.)\nReturn a gear to its owner's hand.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "return_to_hand", target: { chosen: true, cardType: "gear" } } },
  ],
});
