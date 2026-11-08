/** Staged Showdown/Combat helpers — rules 323.7–323.9. */
import type { BattlefieldZone, RulesState } from "@rift/protocol";

export function stageShowdown(rules: RulesState, zone: BattlefieldZone): void {
  if (!rules.staged.showdowns.includes(zone)) rules.staged.showdowns.push(zone);
}

export function unstageShowdown(rules: RulesState, zone: BattlefieldZone): void {
  rules.staged.showdowns = rules.staged.showdowns.filter((entry) => entry !== zone);
}

export function stageCombat(rules: RulesState, zone: BattlefieldZone): void {
  if (!rules.staged.combats.includes(zone)) rules.staged.combats.push(zone);
}

export function unstageCombat(rules: RulesState, zone: BattlefieldZone): void {
  rules.staged.combats = rules.staged.combats.filter((entry) => entry !== zone);
}
