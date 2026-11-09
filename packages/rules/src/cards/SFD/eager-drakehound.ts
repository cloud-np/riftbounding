/** Eager Drakehound. */
import { enterReady, registerCardScript } from "../sdk";

registerCardScript({
  name: "Eager Drakehound",
  text: "I enter ready.",
  status: "implemented",
  abilities: [enterReady()],
});
