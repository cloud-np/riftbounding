/** Needlessly Large Yordle. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Needlessly Large Yordle",
  text: "[Shield 5] (+5 [Might] while I'm a defender.)\n[TANK] (I must be assigned combat damage first.)\nI cost [2][Calm] less for each point you scored from holding this turn.",
  status: "partial",
  notes:
    '"I cost [2][Calm] less for each point you scored from holding this turn": points scored from holding are not tracked separately from conquering (472, 356.4); only the printed Shield 5 and Tank are automated.',
  abilities: [],
});
