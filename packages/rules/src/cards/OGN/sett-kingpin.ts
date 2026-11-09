/**
 * Sett, Kingpin (OGN-240) — "[TANK] I get +1 [Might] for each buffed friendly unit at my
 * battlefield."
 *
 * [Tank] (815) is the combat layer's. A Might passive (365.1) whose amount counts the buffed
 * friendly units at my location, himself included when buffed; it applies only while that location
 * is a battlefield (the base is not a battlefield, 106/107).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, SELF_AT_BATTLEFIELD } from "../dsl";

registerCardScript({
  name: "Sett, Kingpin",
  text: "[TANK] (I must be assigned combat damage first.)\nI get +1 [Might] for each buffed friendly unit at my battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: SELF_AT_BATTLEFIELD, modifier: {
            kind: "might",
            amount: {
              kind: "count",
              selector: { cardType: "unit", controller: "self", zone: HERE, buffed: true },
            },
            target: SELF,
          } },
    },
  ],
});
