/** Determined Sentry. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Determined Sentry",
  text: "I can't move to base.",
  status: "manual",
  notes:
    "A destination-qualified move restriction ('can't move to base') cannot be expressed: the restriction layer knows the mover and the destination only as a plain query and has no destination filter (055, 421).",
  abilities: [],
});
