/** Karthus, Eternal — your Deathknell triggers an additional time (383, 808). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Karthus, Eternal",
  text: "Your [deathknell] trigger an additional time",
  status: "manual",
  notes:
    "Not automated: a trigger-multiplying replacement (no 'triggers an additional time' modifier, 383.1).",
  abilities: [],
});
