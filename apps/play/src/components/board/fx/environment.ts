"use client";

/**
 * Publishes render-environment flags on <html> so CSS can cheapen / pause decorative loops:
 *   data-fx-tier="high|medium|software"   (device class, see quality.ts)
 *   data-fx-hidden="true"                 (tab hidden)
 *   data-fx-level="full|reduced|off"      (effective animation setting, see theme/motion.ts)
 */
import { useEffect } from "react";

import { useAnimationLevel } from "../theme/motion";
import { renderTier } from "./quality";

export function useFxEnvironment(): void {
  const level = useAnimationLevel();
  useEffect(() => {
    document.documentElement.dataset.fxLevel = level;
  }, [level]);
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
