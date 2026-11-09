/** Gearhead. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Gearhead",
  text: "[Accelerate] (You may pay [1][Mind] as an additional cost to have me enter ready.)\nEach Equipment attached to me gives double its base Might bonus.",
  status: "partial",
  notes:
    '"Each Equipment attached to me gives double its base Might bonus": an Equipment\'s Might bonus is not readable as an amount, so the doubling cannot be expressed (718.4); only the printed Accelerate is automated.',
  abilities: [],
});
