/** Perched Grimwyrm. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Perched Grimwyrm",
  text: "Play me only to a battlefield you conquered this turn. (You can't play me anywhere else.)",
  status: "manual",
  notes:
    '"Play me only to a battlefield you conquered this turn": per-card play-location requirements are not supported (355.2.b, 355.17).',
  abilities: [],
});
