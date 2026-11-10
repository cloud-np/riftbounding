"use client";

/**
 * Publishes render-environment flags on <html> so CSS can cheapen / pause decorative loops:
 *   data-fx-tier="high|medium|software"   (device class, see quality.ts)
 *   data-fx-hidden="true"                 (tab hidden)
 */
import { useEffect } from "react";

import { renderTier } from "./quality";

export function useFxEnvironment(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fxTier = renderTier();
    const sync = () => {
      if (document.hidden) root.dataset.fxHidden = "true";
      else delete root.dataset.fxHidden;
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
}
