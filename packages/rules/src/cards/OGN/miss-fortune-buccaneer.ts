/** Miss Fortune, Buccaneer — may be played to an open battlefield, as may friendly units (355.2). */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Miss Fortune, Buccaneer",
  text: "You may play me to an open battlefield. Friendly units may be played to open battlefields.",
  status: "manual",
  notes: "Not automated: a passive play-location permission (355.2.b).",
  abilities: [],
});
