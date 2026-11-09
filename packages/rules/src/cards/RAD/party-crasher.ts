/** Party Crasher (RAD-122) — "I cost [1] less for each exhausted unit you control. [Tank]" (356.4, 366.2.a) */
import { costLessForEach, registerCardScript } from "../sdk";

registerCardScript({
  name: "Party Crasher",
  text: "I cost [1] less for each exhausted unit you control.\n[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: costLessForEach({ cardType: "unit", controller: "self", exhausted: true }, 1, 9),
});
