/** Shared intent-handler context (§3). */
import type { ChoiceRecord, Room, RulesIntent, RulesState } from "@rift/protocol";
import type { RulesContext, RulesHost } from "../host";
import type { RulesFailure, RulesStepContext } from "../types";

export interface IntentContext {
  room: Room;
  rules: RulesState;
  actorId: string;
  intent: RulesIntent;
  ctx: RulesContext;
  host: RulesHost;
  step: RulesStepContext;
}

export type IntentResult = { ok: true } | RulesFailure;
export type IntentHandler = (context: IntentContext) => IntentResult;

export function normalizeChoices(value: ChoiceRecord | undefined): ChoiceRecord {
  return value && typeof value === "object" ? { ...value } : {};
}
