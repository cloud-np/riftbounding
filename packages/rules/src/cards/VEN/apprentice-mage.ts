/**
 * Apprentice Mage (VEN-047) — "[Empower][2] When I become [Empowered], [Predict 2].
 * [Empowered] I have +1 [Might]."
 *
 * 442.2.a: becoming Empowered is an event; 437 Predict; 828.1.c the Dependent Might bonus.
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { WHEN_I_BECOME_EMPOWERED, empower, whileEmpowered } from "./shared";

registerCardScript({
  name: "Apprentice Mage",
  text: "[Empower][2] ([2]: Empower me. Use only if not Empowered.)\nWhen I become [Empowered], [Predict 2]. (Look at the top 2 cards of your Main Deck. Recycle any of them and put the rest back in any order.)\n[Empowered] I have +1 [Might]",
  status: "implemented",
  abilities: [
    empower({ energy: 2 }),
    { kind: "triggered", trigger: WHEN_I_BECOME_EMPOWERED, effect: { op: "predict", amount: 2 } },
    whileEmpowered({ kind: "might", amount: 1, target: SELF }),
  ],
});
