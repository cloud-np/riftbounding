/** Assembly Rig. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Assembly Rig",
  text: "[1][Fury], Recycle a unit from your trash, [Tap]: Play a 3  Mech unit token to your base.",
  status: "manual",
  notes:
    'Its cost "Recycle a unit from your trash" is not a payable cost in the engine (cost-text unsupported, 203.3, 417.6).',
  abilities: [],
});
