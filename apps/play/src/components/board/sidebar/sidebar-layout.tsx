"use client";

/**
 * Sidebar layout state — port of the original header "sidebar layout" tool
 * (`toggleSidebar`, 0xawjzm3yjpr1.js ~2362450). On desktop the original collapses the
 * inline sidebar column into a narrow rail; the board field expands to fill the space
 * and a rail-side control re-opens it.
 *
 * The state lives in `GameBoardView` (which owns the layout) and is exposed through
 * context so the header tool and the collapsed-rail trigger can drive it.
 */
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface SidebarLayoutValue {
  collapsed: boolean;
  toggle: () => void;
  expand: () => void;
}

export const SidebarLayoutContext = createContext<SidebarLayoutValue | null>(null);

export function useSidebarLayoutState(): SidebarLayoutValue {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((current) => !current), []);
  const expand = useCallback(() => setCollapsed(false), []);
  return useMemo(() => ({ collapsed, toggle, expand }), [collapsed, expand, toggle]);
}

/** Returns `null` when rendered outside a board (e.g. isolated header tests). */
export function useSidebarLayout(): SidebarLayoutValue | null {
  return useContext(SidebarLayoutContext);
}
