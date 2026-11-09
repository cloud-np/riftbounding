/** Void Hatchling. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Void Hatchling",
  text: "If you would reveal cards from a deck, look at the top card first. You may recycle it. Then reveal those cards.",
  status: "manual",
  notes:
    '"If you would reveal cards from a deck, look at the top card first": a replacement of reveal events (425, 375) is not supported by the interceptor.',
  abilities: [],
});
