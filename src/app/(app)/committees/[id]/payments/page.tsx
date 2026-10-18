import Link from "next/link";
import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PaymentForm } from "@/components/PaymentForm";
import { ReceiptTools } from "@/components/ReceiptTools";
import { EmptyState, ErrorNote } from "@/components/states";
import { getCommittee, getPayments, getReceipts, getTurns, isUuid } from "@/lib/dal";
import { formatDate, todayInPakistan } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { METHOD_LABELS, cellOf, currentPeriod, lateText, periodLabel, type Method, type PaidRecord } from "@/lib/payments";
import { inPlayOrder } from "@/lib/turns";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `Payments · ${c.name}` : "Payments" };
}

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; slot?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const c = await getCommittee(id);
  if (!c) notFound();

  if (c.status === "forming") {
    return (
      <PageTransition>
        <CommitteeHeader committee={c} active="payments" />
        <EmptyState title="This committee has not started" action={<Link className="btn primary" href={`/committees/${id}`}>Continue setting up</Link>}>
          Add every member, set the turn order, then start it. Payments open once it is running.
        </EmptyState>
      </PageTransition>
    );
  }

  const [turns, payments, receipts] = await Promise.all([getTurns(id, c.periods), getPayments(id), getReceipts(id)]);
  if (!turns || !payments || !receipts) {
    return (
      <PageTransition>
        <CommitteeHeader committee={c} active="payments" />
        <ErrorNote>We couldn&rsquo;t load the payments. Check the connection and refresh the page.</ErrorNote>
      </PageTransition>
    );
  }

  const today = todayInPakistan();
  const terms = { startDate: c.start_date, dueDay: c.due_day, graceDays: c.grace_days, periods: c.periods };
  const money = (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping });
  const open = c.status === "running";

  // Which month is on screen: the one asked for, else this month's, else the first or last if today is outside the committee.
  const now = currentPeriod(c.start_date, today);
  const asked = Number(query.period);
  const period = Number.isInteger(asked) && asked >= 1 && asked <= c.periods ? asked : Math.min(Math.max(now, 1), c.periods);

  const ordered = inPlayOrder(turns);
  const byKey = new Map<string, PaidRecord & { method: string; paymentId: string }>(
    payments.map((p) => [`${p.slotId}|${p.period}`, { slotId: p.slotId, period: p.period, paidOn: p.paidOn, method: p.method, paymentId: p.id }]),
  );
  const rows = ordered.map((t) => {
    const holder = t.holders.find((h) => h.fromPeriod <= period && (h.toPeriod === null || h.toPeriod >= period));
    const record = byKey.get(`${t.id}|${period}`);
    return { slot: t, who: holder?.name ?? t.label, cell: cellOf(terms, today, t.id, period, record), method: record?.method, paymentId: record?.paymentId };
  });
  const paidCount = rows.filter((r) => r.cell.state === "paid").length;
  const collected = paidCount * c.amount;

  const recorded = payments.map((p) => `${p.slotId}|${p.period}`);
  const firstUnpaid = rows.find((r) => r.cell.state !== "paid");
  const wantedSlot = isUuid(query.slot ?? "") && ordered.some((t) => t.id === query.slot) ? (query.slot as string) : (firstUnpaid?.slot.id ?? "");
  const periods = Array.from({ length: c.periods }, (_, i) => ({ period: i + 1, label: periodLabel(c.start_date, i + 1) }));
  const href = (p: number) => `/committees/${id}/payments?period=${p}`;

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="payments" />

      <div className="rise" style={{ ["--i" as string]: 2 }}>
        <div className="pager" role="group" aria-label="Month">
          {period > 1 ? (
            <Link className="btn ghost small" href={href(period - 1)} aria-label={`Earlier month, ${periodLabel(c.start_date, period - 1)}`}>
              <Icon name="back" />
            </Link>
          ) : (
            <span className="btn ghost small" aria-hidden="true" style={{ visibility: "hidden" }}>
              <Icon name="back" />
            </span>
          )}
          <h2 className="pagerlabel" aria-live="polite">
            {periodLabel(c.start_date, period)} <span className="mut sm">period {period} of {c.periods}</span>
          </h2>
          {period < c.periods ? (
            <Link className="btn ghost small" href={href(period + 1)} aria-label={`Later month, ${periodLabel(c.start_date, period + 1)}`}>
              <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
                <Icon name="back" />
              </span>
            </Link>
          ) : (
            <span className="btn ghost small" aria-hidden="true" style={{ visibility: "hidden" }}>
              <Icon name="back" />
            </span>
          )}
        </div>
        <p className="sentence">
          <b>
            {paidCount} of {rows.length}
          </b>{" "}
          paid &middot; {money(collected)} collected. Due {formatDate(rows[0]?.cell.due ?? today)}
          {c.grace_days > 0 ? `, ${c.grace_days} grace day${c.grace_days === 1 ? "" : "s"}` : ""}.
        </p>

        <div className="two">
          <section aria-labelledby="slots-h">
            <h2 id="slots-h">Who has paid</h2>
            <div className="list">
              {rows.map((r) => (
                <div className="li" key={r.slot.id}>
                  <div className="grow">
                    <span className="t" dir="auto">
                      {r.who}
                    </span>
                    <span className="s">
                      {r.cell.state === "paid" ? (
                        <>
                          Paid {formatDate(r.cell.paidOn as string)} &middot; {METHOD_LABELS[r.method as Method] ?? r.method}
                          {r.cell.daysLate > 0 ? <> &middot; {lateText(r.cell.daysLate)}</> : null}
                        </>
                      ) : r.cell.state === "late" ? (
                        <>Not recorded &middot; due {formatDate(r.cell.due)}</>
                      ) : r.cell.state === "due" ? (
                        <>Due {formatDate(r.cell.due)}</>
                      ) : (
                        <>Not due until {formatDate(r.cell.due)}</>
                      )}
                    </span>
                    {r.cell.state === "paid" && r.paymentId ? (
                      <ReceiptTools committeeId={id} paymentId={r.paymentId} who={r.who} receipts={receipts.get(r.paymentId) ?? []} editable={open} />
                    ) : null}
                  </div>
                  {r.cell.state === "paid" ? (
                    <span className="chip paid">
                      <Icon name="check" />
                      Paid
                    </span>
                  ) : r.cell.state === "late" ? (
                    <span className="chip late">
                      <Icon name="alert" />
                      {lateText(r.cell.daysLate)}
                    </span>
                  ) : (
                    <span className="chip">{r.cell.state === "due" ? "Due" : "Upcoming"}</span>
                  )}
                  {open && r.cell.state !== "paid" ? (
                    <Link className="btn secondary small" href={`/committees/${id}/payments?period=${period}&slot=${r.slot.id}#record`} aria-label={`Record a payment for ${r.who}`}>
                      Record
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <div className="stack">
            {open ? (
              <PaymentForm
                committeeId={id}
                instalmentText={money(c.amount)}
                periods={periods}
                slots={ordered.map((t) => ({ id: t.id, label: t.label, holders: t.holders }))}
                recorded={recorded}
                today={today}
                defaults={{ slotId: wantedSlot, period }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
