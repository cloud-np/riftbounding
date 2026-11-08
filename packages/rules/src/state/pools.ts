/** Rune Pool projection — rule 165 (display only; the pool itself lives in `RulesState`). */
import type { Room, RulesState } from "@rift/protocol";

/** Mirror Rune Pools onto the sandbox floating-resource display. */
export function projectPools(room: Room, rules: RulesState): void {
  for (const player of room.players) {
    if (!player.board) continue;
    const pool = rules.pools[player.id] ?? { energy: 0, power: {} };
    player.board.floatingEnergy = pool.energy;
    player.board.floatingPower = Object.values(pool.power).reduce(
      (sum, value) => sum + (typeof value === "number" ? value : 0),
      0,
    );
  }
}
