/** Forgotten Monument. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Forgotten Monument",
  text: "Players can't score here until their third turn.",
  status: "manual",
  notes:
    '"Players can\'t score here until their third turn": score restrictions are evaluated without a subject, so no passive restriction can match (470, 054.1), and turn counts per player are not tracked.',
  abilities: [],
});
