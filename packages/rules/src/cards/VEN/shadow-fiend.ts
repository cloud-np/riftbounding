/** Shadow Fiend (VEN-014) — "[Empower][2][Fury] [Empowered] I have [Assault 3]." (827.1.c.1, 828.1.c) */
import { empower, notIntrinsic, whileEmpowered } from "./shared";
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Shadow Fiend",
  text: "[empower][2][fury] ([2][fury]: Empower me. Use only if not Empowered.)\n[empowered] I have [assault 3]. (+3[might] while I'm an attacker.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    empower({ energy: 2, power: { Fury: 1 } }),
    whileEmpowered({ kind: "keyword", keyword: "Assault", value: 3, target: SELF }),
  ],
});
