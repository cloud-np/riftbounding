/** Repair Specialist. */
import { notIntrinsic, registerCardScript, SELF } from "../sdk";
import { perCount } from "./custom";

registerCardScript({
  name: "Repair Specialist",
  text: "I have [Assault] equal to the number of gear you control. (+1 [Might] while I'm an attacker for each instance of Assault.)",
  status: "implemented",
  abilities: [
    // 807.2: instances add up; one instance per gear you control (bounded at 20 gear).
    ...notIntrinsic("Assault"),
    ...perCount({ cardType: "gear", controller: "self" }, 20, () => ({
      kind: "keyword",
      keyword: "Assault",
      target: SELF,
    })),
  ],
});
