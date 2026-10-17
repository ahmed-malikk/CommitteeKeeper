import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { Icon } from "./Icon";

const STATUS_CLASS = { forming: "form", running: "run", completed: "done" } as const;
const STATUS_TEXT = { forming: "Forming", running: "Running", completed: "Completed" } as const;

type Summary = {
  id: string;
  name: string;
  amount: number;
  periods: number;
  start_date: string;
  status: string;
  display_style: "rs" | "rs_dash";
  display_grouping: "western" | "lakh";
};

/** The top of every page inside one committee: back link, name, status, the key numbers, and the page switcher. */
export function CommitteeHeader({ committee: c, active, children }: { committee: Summary; active: "agreement" | "members" | "turns"; children?: ReactNode }) {
  const status = c.status as keyof typeof STATUS_CLASS;
  const money = formatRupees(c.amount, { style: c.display_style, grouping: c.display_grouping });
  return (
    <>
      <div className="crumb">
        <Link className="btn ghost small" href="/committees">
          <Icon name="back" />
          My committees
        </Link>
      </div>
      <div className="head">
        <div>
          <h1 dir="auto" className="cname">
            {c.name}
          </h1>
          <div className="meta">
            <span className={`chip ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
            <span>
              {money} &middot; {c.periods} periods &middot; starts {formatDate(c.start_date)}
            </span>
          </div>
        </div>
        {children}
      </div>
      <nav className="subnav" aria-label="This committee">
        <Link href={`/committees/${c.id}`} aria-current={active === "agreement" ? "page" : undefined}>
          Agreement
        </Link>
        <Link href={`/committees/${c.id}/members`} aria-current={active === "members" ? "page" : undefined}>
          Members
        </Link>
        <Link href={`/committees/${c.id}/turns`} aria-current={active === "turns" ? "page" : undefined}>
          Turns
        </Link>
      </nav>
      {status === "completed" ? (
        <p className="note readonly" role="status" style={{ marginBottom: 16 }}>
          <Icon name="lock" />
          <span>This committee is completed. Its record is read-only: nothing in it can be changed.</span>
        </p>
      ) : null}
    </>
  );
}
