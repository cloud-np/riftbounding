/**
 * Persisted-state compatibility for the typed DSL members (maintainability review F2/G8).
 *
 * Before the generic `custom` ids became typed `Condition` / `Modifier` members, continuous
 * effects, delayed triggers and pending chain items stored them in room state as
 * `{ kind: "custom", id: "conditional" | "enter-ready" | "self-empowered" | … , params }`. A room
 * saved by an older build still carries that JSON; these pure functions read it as the typed
 * form. Card scripts never use the legacy form (`CustomId` requires a `<owner>:` prefix and the
 * registry integrity test rejects unprefixed ids).
 */
import type { Condition, Modifier } from "@rift/protocol";

type Legacy = { kind?: unknown; id?: unknown; params?: Record<string, unknown> };

const SELF_STATES: Record<string, "at-battlefield" | "empowered" | "mighty" | "buffed"> = {
  "self-at-battlefield": "at-battlefield",
  "self-empowered": "empowered",
  "self-mighty": "mighty",
  "self-buffed": "buffed",
};

/** The typed form of a legacy unprefixed custom condition (or the condition itself). */
export function upgradeLegacyCondition(condition: Condition): Condition {
  const legacy = condition as Legacy;
  if (legacy.kind !== "custom" || typeof legacy.id !== "string" || legacy.id.includes(":")) return condition;
  const params = legacy.params ?? {};
  const state = SELF_STATES[legacy.id];
  if (state) return { kind: "self-state", state };
  switch (legacy.id) {
    case "did":
    case "paid-additional":
    case "first-played-this-turn":
      return { kind: legacy.id };
    case "xp-at-least":
      return { kind: "xp-at-least", amount: typeof params.n === "number" ? params.n : 0 };
    case "alone":
    case "in-ref":
      return { kind: legacy.id, ...(typeof params.ref === "string" ? { ref: params.ref } : {}) };
    case "in-ids":
      return { kind: "in-ids", ids: Array.isArray(params.ids) ? (params.ids as string[]) : [] };
    case "showed-off":
      return { kind: "showed-off", ...(typeof params.count === "number" ? { count: params.count } : {}) };
    case "marked":
      return { kind: "marked", key: String(params.key ?? ""), ...(params.value !== undefined ? { value: params.value as never } : {}) };
    case "cards-played":
      return { kind: "cards-played", ...(params.op ? { op: params.op as never } : {}), ...(typeof params.value === "number" ? { value: params.value } : {}) };
    case "event-zone-is":
      return {
        kind: "event-zone-is",
        ...(params.battlefield === true ? { battlefield: true } : {}),
        ...(typeof params.zone === "string" ? { zone: params.zone } : {}),
      };
    default:
      return condition;
  }
}

/** The typed form of a legacy unprefixed custom modifier (or the modifier itself). */
export function upgradeLegacyModifier(modifier: Modifier): Modifier {
  const legacy = modifier as Legacy;
  if (legacy.kind !== "custom" || typeof legacy.id !== "string" || legacy.id.includes(":")) return modifier;
  const params = legacy.params ?? {};
  switch (legacy.id) {
    case "conditional": {
      const inner = params.modifier as Modifier | undefined;
      const condition = params.condition as Condition | undefined;
      if (!inner) return modifier;
      return { kind: "while", condition: condition ?? { kind: "true" }, modifier: upgradeLegacyModifier(inner) };
    }
    case "rules-text": {
      const inner = params.modifier as Modifier | undefined;
      return inner ? { kind: "rules-text", modifier: upgradeLegacyModifier(inner) } : modifier;
    }
    case "enter-ready":
    case "cost-adjust":
    case "show-off":
    case "bonus-damage":
    case "hide-limit":
    case "assigned-last":
    case "ignore-keyword":
    case "victory-score":
    case "remove-keyword":
      return { kind: legacy.id, ...params } as Modifier;
    default:
      return modifier;
  }
}
