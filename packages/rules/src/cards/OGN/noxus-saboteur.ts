/** Noxus Saboteur — your opponents' Hidden cards can't be revealed here (811.1.c). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Noxus Saboteur",
  text: "Your opponents' [HIDDEN] cards can't be revealed here.",
  status: "manual",
  notes:
    "Not automated: a restriction on revealing facedown cards at a location (no restriction kind for reveal).",
  abilities: [],
});
