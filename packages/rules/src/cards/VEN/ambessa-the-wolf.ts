/**
 * Ambessa, The Wolf (VEN-084) — "[Empower][3][Body] [Empowered] I have +3 [Might] and can't be
 * dealt damage unless I'm in combat."
 *
 * 828.1.c Dependent abilities; 740.2.c "in combat"; the restriction is read by `deal` and by
 * combat damage assignment (467.2.c.10).
 */
import { registerCardScript } from "../registry";
import { SELF, custom, not } from "../dsl";
import { SELF_EMPOWERED, conditional, empower, whileEmpowered } from "./shared";

registerCardScript({
  name: "Ambessa, The Wolf",
  text: "[Empower][3][Body]\n[Empowered] I have +3 [Might] and can't be dealt damage unless I'm in combat.",
  status: "implemented",
  abilities: [
    empower({ energy: 3, power: { Body: 1 } }),
    whileEmpowered({ kind: "might", amount: 3, target: SELF }),
    conditional(
      { kind: "and", conditions: [SELF_EMPOWERED, not(custom("ven:self-in-combat"))] },
      { kind: "restriction", restriction: "be-dealt-damage", target: SELF },
    ),
  ],
});
