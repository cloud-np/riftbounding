/**
 * Ambessa, The Wolf (VEN-084) — "[Empower][3][Body] [Empowered] I have +3 [Might] and can't be
 * dealt damage unless I'm in combat."
 *
 * 828.1.c Dependent abilities; 740.2.c "in combat"; the restriction is read by `deal` and by
 * combat damage assignment (467.2.c.10).
 */
import { SELF_EMPOWERED, conditional, empower, whileEmpowered } from "./shared";
import { custom, not, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ambessa, The Wolf",
  text: "[Empower][3][Body]\n[Empowered] I have +3 [Might] and can't be dealt damage unless I'm in combat.",
  status: "implemented",
  abilities: [
    empower({ energy: 3, power: { Body: 1 } }),
    whileEmpowered({ kind: "might", amount: 3, target: SELF }),
    conditional(
      { kind: "and", conditions: [SELF_EMPOWERED, not(custom("core:in-combat"))] },
      { kind: "restriction", restriction: "be-dealt-damage", target: SELF },
    ),
  ],
});
