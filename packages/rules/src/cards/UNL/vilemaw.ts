/**
 * Vilemaw (UNL-060) — [Ambush] (822, engine keyword). "Enemy units here with less Might than me
 * don't deal combat damage." (467.2.a/b: such units contribute 0 to their side's total; registered
 * with R2-combat's contribution-filter extension point.) "When I hold, draw 1." (383.4.d)
 */
import type { Room } from "@rift/protocol";
import type { RulesHost } from "../../host";
import { getCardScript, registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { registerCombatContributionFilter } from "../../combat/keywords";
import { effectiveMight } from "../../layers";
import { unitsPresentAt } from "../../state/presence";

registerCardScript({
  name: "Vilemaw",
  text: "[Ambush] (You may play me as a [reaction] to a battlefield where you have units)\nEnemy units here with less Might than me don't deal combat damage.\nWhen I hold, draw 1.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});

/** False when an enemy Vilemaw at the unit's location has more Might than it (pure read). */
function contributes(room: Room, unitId: string, host: RulesHost): boolean {
  const located = host.findCard(room, unitId);
  if (!located) return true;
  // The filter is registered at import; it only applies while the scripted card is in use.
  const script = getCardScript("Vilemaw");
  if (!script || script.status === "manual") return true;
  const might = effectiveMight(room, unitId, host);
  return !unitsPresentAt(room, host, located.zone).some(
    (card) =>
      card.name === "Vilemaw" &&
      card.id !== unitId &&
      host.findCard(room, card.id)?.playerId !== located.playerId &&
      effectiveMight(room, card.id, host) > might,
  );
}

registerCombatContributionFilter(contributes);
