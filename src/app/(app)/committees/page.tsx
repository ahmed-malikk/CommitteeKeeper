import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { EmptyState, ErrorNote } from "@/components/states";
import { getPaymentFacts, payerName, requireUser } from "@/lib/dal";
import { formatDate, todayInPakistan } from "@/lib/dates";
import { lateText, summarise } from "@/lib/payments";
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
    .select("id, name, amount, periods, start_date, due_day, grace_days, status, display_style, display_grouping")
    .eq("organiser_id", user.id)
    .order("created_at", { ascending: false });

  // What is owed in each running committee, counted the same way as on the committee's own payments screen.
  const today = todayInPakistan();
  const running = (data ?? []).filter((c) => c.status === "running");
  const facts = await getPaymentFacts(running.map((c) => c.id));
  const summaries = new Map(
    running.flatMap((c) => {
      const f = facts?.get(c.id);
      if (!f) return [];
      const terms = { startDate: c.start_date, dueDay: c.due_day, graceDays: c.grace_days, periods: c.periods };
      return [[c.id, { summary: summarise(terms, today, f.slotIds, f.paid), facts: f }] as const];
    }),
  );
  const needs = running
    .flatMap((c) => {
      const entry = summaries.get(c.id);
      if (!entry) return [];
      return entry.summary.late.map((cell) => ({ c, cell, who: payerName(entry.facts.holders, cell.slotId, cell.period) }));
    })
    .sort((a, b) => b.cell.daysLate - a.cell.daysLate)
    .slice(0, 6);
  const lateTotal = [...summaries.values()].reduce((n, e) => n + e.summary.late.length, 0);

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
          <div className="two">
            <section aria-labelledby="all-h">
              <h2 id="all-h">All committees</h2>
              <div className="list">
                {data.map((c) => {
                  const status = c.status as keyof typeof STATUS_CLASS;
                  const entry = summaries.get(c.id);
                  const sm = entry?.summary;
                  const progress =
                    status === "running" && sm
                      ? sm.period === null
                        ? sm.late.length > 0
                          ? "no period this month"
                          : "no instalment due this month"
                        : `${sm.paidThisPeriod} of ${sm.slotCount} paid this month`
                      : null;
                  return (
                    <Link className="li" key={c.id} href={status === "running" ? `/committees/${c.id}/payments` : `/committees/${c.id}`}>
                      <div className="grow">
                        <span className="t" dir="auto">
                          {c.name}
                        </span>
                        <span className="s">
                          You organise &middot; {formatRupees(c.amount, { style: c.display_style, grouping: c.display_grouping })} &middot; {c.periods} periods
                          {progress ? <> &middot; {progress}</> : <> &middot; starts {formatDate(c.start_date)}</>}
                        </span>
                      </div>
                      {sm && sm.late.length > 0 ? (
                        <span className="chip late">
                          <Icon name="alert" />
                          {sm.late.length} late
                        </span>
                      ) : null}
                      <span className={`chip ${STATUS_CLASS[status]}`}>{STATUS_TEXT[status]}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
            <section aria-labelledby="needs-h">
              <h2 id="needs-h">Needs you today</h2>
              {facts === null && running.length > 0 ? (
                <ErrorNote>We couldn&rsquo;t check the payments. Refresh the page to try again.</ErrorNote>
              ) : needs.length === 0 ? (
                <p className="note ok">
                  <Icon name="check" />
                  <span>Nobody is late. Nothing needs you today.</span>
                </p>
              ) : (
                <>
                  <div className="list">
                    {needs.map(({ c, cell, who }) => (
                      <Link className="li" key={`${c.id}-${cell.slotId}-${cell.period}`} href={`/committees/${c.id}/payments?period=${cell.period}&slot=${cell.slotId}#record`}>
                        <div className="grow">
                          <span className="t" dir="auto">
                            {who} is {lateText(cell.daysLate)}
                          </span>
                          <span className="s" dir="auto">
                            {c.name} &middot; due {formatDate(cell.due)} &middot; {formatRupees(c.amount, { style: c.display_style, grouping: c.display_grouping })}
                          </span>
                        </div>
                        <Icon name="chev" />
                      </Link>
                    ))}
                  </div>
                  {lateTotal > needs.length ? (
                    <p className="sm mut" style={{ marginTop: 10 }}>
                      Showing the {needs.length} longest late of {lateTotal}. The rest are on each committee&rsquo;s Payments page.
                    </p>
                  ) : null}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
