/** Forge of the Fluft. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Forge of the Fluft",
  text: 'While you control this battlefield, friendly legends have "[Tap]: Attach an Equipment you control to a unit you control."',
  status: "manual",
  notes:
    "\"Friendly legends have '[Tap]: Attach an Equipment you control to a unit you control'\": passives cannot grant activated abilities to other objects (366, 718).",
  abilities: [],
});
