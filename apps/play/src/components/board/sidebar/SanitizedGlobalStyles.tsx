"use client";

/**
 * Scoped CSS for the responsive sidebar shell.
 *
 * `GameBoardView` owns the outer `<aside data-slot="sidebar">`; below 1100px the original
 * hides the desktop column entirely, so collapse the host element only while our root is
 * mounted (`:has` keeps it scoped to this slot).
 */
export function SanitizedGlobalStyles() {
  return (
    <style>{`
[data-tablet-sidebar-portal] [data-tablet-sidebar-trigger] {
  display: none;
}

@media (max-width: 1100px) {
  aside[data-slot="sidebar"]:has(> [data-sidebar-slot-root]) {
    width: 0 !important;
    min-width: 0 !important;
    flex-basis: 0 !important;
    overflow: visible !important;
  }
  [data-sidebar-slot-root] [data-sidebar-inline] {
    display: none !important;
  }
  [data-tablet-sidebar-portal] [data-tablet-sidebar-trigger] {
    display: flex !important;
  }
}
`}</style>
  );
}
