import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { PopText } from "./PopText";

// The empty rosette: concentric guilloche rings, the same drawing as the approved prototype.
// Each ring draws itself in (pathLength 1 lets one CSS rule animate every shape), then the rosette turns slowly.
function Rosette() {
  return (
    <svg className="big" viewBox="-75 -75 150 150" fill="none" strokeWidth=".7" aria-hidden="true">
      <g className="spin">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse key={i} rx="70" ry="26" transform={`rotate(${i * 30})`} stroke="var(--peri)" pathLength={1} style={{ ["--d" as string]: `${i * 90}ms` }} />
        ))}
        <circle r="36" stroke="var(--teal)" pathLength={1} style={{ ["--d" as string]: "540ms" }} />
        <circle r="22" stroke="var(--rose)" pathLength={1} style={{ ["--d" as string]: "700ms" }} />
      </g>
    </svg>
  );
}

/** Nothing here yet: says what the place is for and offers the first step. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Rosette />
      <PopText as="h2" text={title} />
      {children ? <p className="mut">{children}</p> : null}
      {action}
    </div>
  );
}

/** Something went wrong: names the problem and the way out. Announced to screen readers. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="note warn" role="alert">
      <Icon name="alert" />
      <span>{children}</span>
    </div>
  );
}

/** Placeholder bars while content loads. Announced politely, not as a flood of empty boxes. */
export function Skeleton({ lines = [26, 200] }: { lines?: number[] }) {
  return (
    <div className="stack" role="status" aria-label="Loading">
      {lines.map((height, i) => (
        <div key={i} className="skel" style={{ height }} />
      ))}
    </div>
  );
}
