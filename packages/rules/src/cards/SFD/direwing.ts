/** Direwing. */
import { enterReady, registerCardScript } from "../sdk";

registerCardScript({
  name: "Direwing",
  text: "I enter ready if you control another Dragon.",
  status: "implemented",
  abilities: [
    enterReady({
      kind: "exists",
      selector: { controller: "self", tag: "Dragon", excludeSource: true },
    }),
  ],
});
