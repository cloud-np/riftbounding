/** Ancient Warmonger. */
import type { Condition, KeywordName, Modifier, Selector } from "@rift/protocol";
import { notIntrinsic, registerCardScript, SELF, whilePassive } from "../sdk";
import { HERE_ZONE } from "./custom";

/** Stacked keyword instances ("[Assault] equal to …"), `cap` deep. */
function stackedKeyword(
  keyword: KeywordName,
  condition: (k: number) => Condition,
  targetSelector: Selector,
  cap: number,
) {
  return Array.from({ length: cap }, (_, index) =>
    whilePassive(condition(index + 1), {
      kind: "keyword",
      keyword,
      target: targetSelector,
    } satisfies Modifier),
  );
}

registerCardScript({
  name: "Ancient Warmonger",
  text: "[Accelerate] (You may pay [1][Chaos] as an additional cost to have me enter ready.)\nI have [Assault] equal to the number of enemy units here. (+1 [Might] while I'm an attacker for each instance of Assault.)",
  status: "partial",
  notes:
    "Assault equal to the number of enemy units here is expressed as stacked conditional Assault instances (807, 823.2-style summing) up to 10 enemy units; the layers have no computed keyword values (479.3).",
  abilities: [
    ...notIntrinsic("Assault"),
    ...stackedKeyword(
      "Assault",
      (k) => ({
        kind: "count",
        selector: { cardType: "unit", controller: "opponent", zone: HERE_ZONE },
        comparison: { op: "gte", value: k },
      }),
      SELF,
      10,
    ),
  ],
});
