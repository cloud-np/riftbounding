import { useEffect, useMemo, useState } from "react";

import { createTranslator, resolveLocale, type Translator } from "@rift/i18n";

/** UI translator for board chrome; defaults to the canonical English catalogue. */
export function boardTranslator(locale?: string | null): Translator {
  return createTranslator(resolveLocale(locale));
}

export function useBoardTranslator(locale?: string | null): Translator {
  return useMemo(() => boardTranslator(locale), [locale]);
}

/** Small helper: translator lookup with a literal fallback. */
export function text(translator: Translator, key: string, fallback = key): string {
  return translator(key) ?? fallback;
}

/** Ticking wall clock for running match timers. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
  return now;
}
