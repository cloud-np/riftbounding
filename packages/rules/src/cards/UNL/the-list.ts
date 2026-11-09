/** The List. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "The List",
  text: "As you play this, name a tag. (For example, Miss Fortune, Demacia, and Poro are tags.)\n[Tap]: Give a unit with the named tag -2 [Might] this turn.",
  status: "manual",
  notes:
    "Naming a tag as a play-time choice and remembering it on the gear (143) is not implemented; neither is reading the named tag from an activated ability.",
  abilities: [],
});
