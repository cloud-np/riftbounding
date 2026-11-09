/** Forgotten Signpost. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Forgotten Signpost",
  text: "[Action]  Exhaust a unit you control, [tap] : Move a different unit you control to the location of the unit you exhausted to pay for this ability.",
  status: "manual",
  notes:
    "The activated ability exhausts two objects (a chosen unit and itself): `Cost.exhaust` holds one selector (357.2), and the effect must read the cost object's location.",
  abilities: [],
});
