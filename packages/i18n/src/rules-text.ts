/**
 * Strict-rules strings (R2-int): rejection reasons (§5), prompt titles (411.2) and the strict UI.
 *
 * English lives in `data/i18n-en.json` under `ui.rules`:
 *
 *   rules.reason.<ReasonCode>          one sentence per rejection code (+ `unknown` fallback)
 *   rules.promptReason.<reason>        one label per `Prompt.data.reason` (dotted reasons nest)
 *   rules.promptKind.<PromptKind>      one label per prompt kind
 *   rules.prompt.<promptKey>           the `Prompt.promptKey` values the engine emits
 *   rules.ui.<label>                   buttons/labels of the strict board UI
 *
 * fr/ko/zh-CN have no entries yet; `createTranslator` falls back to English for missing keys,
 * exactly like every other untranslated key.
 */

import type { MessageParams, Translator } from "./translator";

/** Minimal prompt shape needed for a title (a redacted prompt shell is enough). */
export interface PromptTitleInput {
  kind: string;
  promptKey?: string;
  data?: {
    reason?: unknown;
    /** Interpolation values for a parameterized `promptKey` (e.g. the optional cost prompt). */
    params?: MessageParams;
  } | null;
}

/** §5: the sentence for a rejection code, optionally followed by its rule (`… (rule 312)`). */
export function rulesReasonText(t: Translator, code: string, rule?: string | null): string {
  const reason = t(`rules.reason.${code}`) ?? t("rules.reason.unknown") ?? code;
  if (!rule) return reason;
  return t("rules.ui.reasonWithRule", { reason, rule }) ?? `${reason} (rule ${rule})`;
}

/** 411.2: the label for a `Prompt.data.reason`, or null for an unknown/absent reason. */
export function promptReasonText(t: Translator, reason: unknown): string | null {
  if (typeof reason !== "string" || reason.length === 0) return null;
  return t(`rules.promptReason.${reason}`);
}

/**
 * Title of a pending prompt: its `promptKey` when it names a catalog key, else the reason label,
 * else the kind label. A `promptKey` that is not a key (a card script's own English label) is
 * shown verbatim.
 */
export function promptTitle(t: Translator, prompt: PromptTitleInput): string {
  const key = prompt.promptKey;
  if (key) {
    const translated = key.startsWith("rules.") ? t(key, prompt.data?.params) : null;
    if (translated) return translated;
    if (!key.startsWith("rules.")) return key;
  }
  return (
    promptReasonText(t, prompt.data?.reason) ?? t(`rules.promptKind.${prompt.kind}`) ?? prompt.kind
  );
}
