import Link from "next/link";
import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { CopyMessage } from "@/components/CopyMessage";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { EmptyState, ErrorNote } from "@/components/states";
import { getCommittee, getPayments, getTurns } from "@/lib/dal";
import { formatDate, todayInPakistan } from "@/lib/dates";
import { mailConfigured } from "@/lib/mail";
import { formatRupees } from "@/lib/money";
import { lateText, periodLabel } from "@/lib/payments";
import { dueList, reminderMessage, whatsappLink, type DueItem, type ReminderKind } from "@/lib/reminders";
import { createClient } from "@/lib/supabase/server";
import { holderAt, inPlayOrder } from "@/lib/turns";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `Reminders · ${c.name}` : "Reminders" };
}

const GROUPS: { kind: ReminderKind; title: string; empty: string }[] = [
  { kind: "late", title: "Late", empty: "Nobody is late." },
  { kind: "due", title: "Due today", empty: "Nothing is due today." },
  { kind: "before", title: "Due soon", empty: "Nothing is due soon." },
];

export default async function RemindersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  if (!c) notFound();

  if (c.status !== "running") {
    return (
      <PageTransition>
        <CommitteeHeader committee={c} active="reminders" />
        <EmptyState title={c.status === "forming" ? "This committee has not started" : "This committee is completed"}>
          {c.status === "forming" ? "Reminders begin once it is running." : "There is nothing left to remind anyone about."}
        </EmptyState>
      </PageTransition>
    );
  }

  const supabase = await createClient();
  const [turns, payments, members] = await Promise.all([
    getTurns(id, c.periods),
    getPayments(id),
    supabase.from("members").select("id, phone").eq("committee_id", id),
  ]);
  if (!turns || !payments || members.error) {
    return (
      <PageTransition>
        <CommitteeHeader committee={c} active="reminders" />
        <ErrorNote>We couldn&rsquo;t load the reminders. Check the connection and refresh the page.</ErrorNote>
      </PageTransition>
    );
  }

  const today = todayInPakistan();
  const terms = { startDate: c.start_date, dueDay: c.due_day, graceDays: c.grace_days, periods: c.periods };
  const settings = { remindBeforeDays: c.remind_before_days, remindLateEvery: c.remind_late_every };
  const ordered = inPlayOrder(turns);
  const items = dueList(terms, settings, today, ordered.map((t) => t.id), payments);
  const phoneOf = new Map((members.data ?? []).map((m) => [m.id, m.phone as string | null]));
  const money = formatRupees(c.amount, { style: c.display_style, grouping: c.display_grouping });
  const slotById = new Map(ordered.map((t) => [t.id, t]));

  const describe = (item: DueItem) => {
    const slot = slotById.get(item.slotId);
    const holder = slot ? holderAt(slot.holders, item.period) : undefined;
    const name = holder?.name ?? slot?.label ?? "A member";
    const message = reminderMessage({ name, committee: c.name, amountText: money, start: c.start_date, period: item.period, kind: item.kind, due: item.due, dueText: formatDate(item.due), daysLate: item.daysLate });
    return { item, name, message, link: whatsappLink(holder ? phoneOf.get(holder.memberId) : null, message) };
  };
  const rows = items.map(describe);
  const toRemind = rows.filter((r) => r.item.remindToday).length;
  const chip = (item: DueItem) =>
    item.kind === "late" ? lateText(item.daysLate) : item.kind === "due" ? (item.daysUntil === 0 ? "Due today" : "In the grace days") : `Due in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="reminders" />
      <div className="rise" style={{ ["--i" as string]: 2 }}>
        <p className="sentence">
          <b>{toRemind === 0 ? "Nobody" : toRemind}</b> to remind today, {formatDate(today)}.
          {" "}Reminders go {c.remind_before_days} day{c.remind_before_days === 1 ? "" : "s"} before the due day, on it, and every {c.remind_late_every} day{c.remind_late_every === 1 ? "" : "s"} while late.
        </p>
        <p className="mut sm" style={{ textAlign: "center", marginBottom: 20 }}>
          {mailConfigured() ? "This list is also emailed to you every morning." : "The daily email is not set up yet; this page shows the same list."}
        </p>

        {GROUPS.map((g) => {
          const group = rows.filter((r) => r.item.kind === g.kind);
          return (
            <section key={g.kind} aria-labelledby={`rem-${g.kind}`} className="remgroup">
              <h2 id={`rem-${g.kind}`}>
                {g.title} <span className="mut sm">{group.length === 0 ? "nobody" : group.length}</span>
              </h2>
              {group.length === 0 ? (
                <p className="mut">{g.empty}</p>
              ) : (
                <div className="list">
                  {group.map((r) => (
                    <div className="li rem" key={`${r.item.slotId}|${r.item.period}`}>
                      <div className="grow">
                        <span className="t" dir="auto">
                          {r.name}
                        </span>
                        <span className="s">
                          {periodLabel(c.start_date, r.item.period)} &middot; due {formatDate(r.item.due)} &middot; {chip(r.item)}
                          {r.item.remindToday ? <b className="today"> &middot; remind today</b> : null}
                        </span>
                        <span className="s msg" dir="auto">
                          {r.message}
                        </span>
                      </div>
                      {r.link ? (
                        <a className="btn primary small" href={r.link} target="_blank" rel="noopener noreferrer" aria-label={`Send the reminder to ${r.name} on WhatsApp`}>
                          <Icon name="out" />
                          WhatsApp
                        </a>
                      ) : (
                        <CopyMessage text={r.message} who={r.name} />
                      )}
                      <Link className="btn ghost small" href={`/committees/${id}/payments?period=${r.item.period}&slot=${r.item.slotId}#record`} aria-label={`Record a payment for ${r.name}, ${periodLabel(c.start_date, r.item.period)}`}>
                        Record
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </PageTransition>
  );
}
