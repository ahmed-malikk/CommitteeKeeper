import { ViewTransition } from "react";
import type { ReactNode } from "react";

/**
 * Wrap a page's content in this so moving between pages slides the old content out and the new content in,
 * while the rail, top bar and iris band stay put (they have their own fixed view-transition names).
 * It must be used inside each page, not in a layout: layouts persist, so enter and exit would never run.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
