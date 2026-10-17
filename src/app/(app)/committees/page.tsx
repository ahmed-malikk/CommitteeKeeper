import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { EmptyState, ErrorNote } from "@/components/states";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My committees" };

const STATUS_CLASS = { forming: "form", running: "run", completed: "done" } as const;
const STATUS_TEXT = { forming: "Forming", running: "Running", completed: "Completed" } as const;

export default async function Committees() {
  const user = await requireUser();
  const supabase = await createClient();
  // Row-level security already limits this to the organiser's own committees; the filter just says so out loud.
  const { data, error } = await supabase
    .from("committees")
    .select("id, name, amount, periods, start_date, status, display_style, display_grouping")
    .eq("organiser_id", user.id)
    .order("created_at", { ascending: false });

  const create = (
    <Link className="btn primary" href="/committees/new">
      <Icon name="plus" />
      New committee
    </Link>
  );

  return (
    <PageTransition>
      <div className="head">
        <PopText text="My committees" />
        {data && data.length > 0 ? create : null}
      </div>
      <div className="rise" style={{ ["--i" as string]: 2 }}>
        {error ? (
          <ErrorNote>We couldn&rsquo;t load your committees. Check the connection and refresh the page.</ErrorNote>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No committees yet" action={create}>
            Create the first one: set the monthly amount, the number of periods and how turns are decided. Then add the members.
          </EmptyState>
        ) : (
          <div className="list">
            {data.map((c) => {
              const status = c.status as keyof typeof STATUS_CLASS;
              return (
                <Link className="li" key={c.id} href={`/committees/${c.id}`}>
                  <div className="grow">
                    <span className="t" dir="auto">
                      {c.name}
                    </span>
                    <span className="s">
                      {formatRupees(c.amount, { style: c.display_style, grouping: c.display_grouping })} &middot; {c.periods} periods &middot; starts {formatDate(c.start_date)}
                    </span>
                  </div>
                  <span className={`chip ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
