/**
 * Structural validation for scenarios (TS files are type-checked; JSON files and typos in
 * optional keys are caught here at run time). Card names are validated by the position builder.
 */
import { didYouMean } from "./catalog";
import type { ScenarioSpec } from "./format";

const TOP_LEVEL = [
  "format",
  "title",
  "event",
  "round",
  "date",
  "sources",
  "verification",
  "notes",
  "rules",
  "tags",
  "position",
  "steps",
  "expectFailure",
];
const VERIFICATION = ["sourced", "reconstructed", "illustrative"];
const COMMON = ["note", "expect", "reject", "by"];
const CHOICE_FIELDS = ["targets", "mode", "x", "choices", "optionalCosts", "pay", "plan", "hold"];

/** Action key → the other keys allowed next to it. */
const STEP_KEYS: Record<string, string[]> = {
  play: [...COMMON, ...CHOICE_FIELDS, "location", "as"],
  hide: [...COMMON, "at", "pay"],
  activate: [...COMMON, ...CHOICE_FIELDS, "ability"],
  move: [...COMMON, "to"],
  pass: COMMON,
  endTurn: COMMON,
  choose: COMMON,
  assign: COMMON,
  order: COMMON,
  manualDone: COMMON,
  concede: COMMON,
  intent: COMMON,
  answer: COMMON,
  settle: ["note", "expect", "max"],
  check: ["note"],
};

const CHECKPOINT_KEYS = [
  "points",
  "alive",
  "dead",
  "units",
  "control",
  "chain",
  "priority",
  "focus",
  "state",
  "turnPlayer",
  "phase",
  "prompt",
  "showdown",
  "combat",
  "zones",
  "winner",
  "events",
  "noEvents",
];

function unknownKeys(
  value: object,
  allowed: readonly string[],
  where: string,
  problems: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      problems.push(`${where}: unknown key ${JSON.stringify(key)}.${didYouMean(key, allowed)}`);
  }
}

function checkCheckpoint(value: unknown, where: string, problems: string[]): void {
  if (!value || typeof value !== "object") {
    problems.push(`${where}: a checkpoint must be an object`);
    return;
  }
  unknownKeys(value, CHECKPOINT_KEYS, where, problems);
}

/** Every structural problem, as readable sentences (empty = valid). */
export function validateScenario(spec: ScenarioSpec): string[] {
  const problems: string[] = [];
  if (!spec || typeof spec !== "object") return ["the scenario must be an object"];
  unknownKeys(spec, TOP_LEVEL, "scenario", problems);
  if (typeof spec.title !== "string" || !spec.title.trim())
    problems.push("scenario: `title` is required");
  if (!VERIFICATION.includes(spec.verification)) {
    problems.push(`scenario: \`verification\` must be one of ${VERIFICATION.join(" | ")}`);
  }
  if (
    (spec.verification === "sourced" || spec.verification === "reconstructed") &&
    !spec.sources?.some((source) => source.url)
  ) {
    problems.push(`scenario: a ${spec.verification} scenario must cite at least one source URL`);
  }
  if (spec.verification === "illustrative" && !spec.notes?.trim()) {
    problems.push("scenario: an illustrative scenario must say in `notes` what it is built from");
  }
  if (spec.expectFailure !== undefined) {
    const reason =
      typeof spec.expectFailure === "string" ? spec.expectFailure : spec.expectFailure.reason;
    if (!reason?.trim()) problems.push("scenario: `expectFailure` needs a reason");
  }
  if (!spec.position || typeof spec.position !== "object")
    problems.push("scenario: `position` is required");
  if (!Array.isArray(spec.steps)) {
    problems.push("scenario: `steps` must be an array");
    return problems;
  }
  spec.steps.forEach((step, index) => {
    const where = `step ${index + 1}`;
    if (!step || typeof step !== "object") {
      problems.push(`${where}: must be an object`);
      return;
    }
    const actions = Object.keys(step).filter((key) => key in STEP_KEYS);
    if (actions.length !== 1) {
      problems.push(
        `${where}: needs exactly one action key (${Object.keys(STEP_KEYS).join(", ")}), got ${actions.length > 0 ? actions.join(", ") : "none"}`,
      );
      return;
    }
    const action = actions[0]!;
    unknownKeys(step, [action, ...STEP_KEYS[action]!], where, problems);
    if (action !== "settle" && action !== "check" && !("by" in step))
      problems.push(`${where}: \`by\` (P1 or P2) is required`);
    const record = step as unknown as Record<string, unknown>;
    if (record.expect !== undefined) checkCheckpoint(record.expect, `${where} expect`, problems);
    if (action === "check") checkCheckpoint(record.check, `${where} check`, problems);
  });
  return problems;
}
