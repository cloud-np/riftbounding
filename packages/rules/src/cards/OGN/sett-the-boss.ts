/**
 * Sett, The Boss (OGN-269, legend, Origins errata) — "If a buffed unit you control would die, you
 * may pay [Rune], exhaust me, and spend its buff to heal it, exhaust it, and recall it instead.
 * When you conquer, ready me."
 *
 * "When you conquer, ready me" is automated (383.4.c.2.b player-level conquer). Partial: the
 * first ability is an optional replacement with costs (371.2, 445) that the replacement layer
 * cannot offer (delayed/printed replacements always apply).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Sett, The Boss",
  text: "If a buffed unit you control would die, you may pay [Rune], exhaust me, and spend its buff to heal it, exhaust it, and recall it instead. (Send it to base. This isn't a move.)\nWhen you conquer, ready me.",
  status: "partial",
  notes:
    "The 'would die … instead' ability is manual: optional replacements with costs (371.2, 445) are not supported.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});
