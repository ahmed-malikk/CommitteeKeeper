"use client";

import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** Opens the browser print dialog, which also offers "Save as PDF". */
export function PrintButton({ children }: { children: ReactNode }) {
  return (
    <button className="btn secondary" type="button" onClick={() => window.print()}>
      <Icon name="print" />
      {children}
    </button>
  );
}
