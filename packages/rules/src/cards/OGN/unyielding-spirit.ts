/**
 * Unyielding Spirit (OGN-145, FAQ errata) — "[Reaction] Prevent all damage that would be dealt this
 * turn by spells and abilities."
 *
 * A prevention effect (438) for the rest of this turn: every deal action that is not combat damage
 * (467; combat damage proposals carry `data.combat`) is prevented entirely (438.3.c "all"), for
 * every player's spells and abilities. Registers `ogn:noncombat-damage` (condition: the
 * proposed damage is not combat damage) and `ogn:prevent-noncombat-damage-this-turn` (adds the
 * replacement for this turn; unlike the core `replace` op it is not used up after one use).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Unyielding Spirit",
  text: "[Reaction] Prevent all damage that would be dealt this turn by spells and abilities.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "custom", id: "ogn:prevent-noncombat-damage-this-turn" } },
  ],
});
