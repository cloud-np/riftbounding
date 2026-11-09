/** Draven, Showboat (OGN-028) — "My might is increased by your points." (479.4 computed passive amount) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Draven, Showboat",
  text: "My might is increased by your points.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "might", amount: { kind: "points" }, target: SELF } },
  ],
});
