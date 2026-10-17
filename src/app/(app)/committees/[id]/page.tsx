import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PrintButton } from "@/components/PrintButton";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { ErrorNote } from "@/components/states";
import { ORDER_LABELS, type OrderMethod } from "@/lib/agreement";
import { formatDate, ordinal, todayInPakistan } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { StatusPanel } from "@/components/StatusPanel";
import { startProblems, lastDueDate } from "@/lib/committee";
import { getCommittee, getSlotInfo } from "@/lib/dal";


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c?.name ?? "Committee" };
}

export default async function CommitteePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { created, saved } = await searchParams;
  const c = await getCommittee(id);
  if (!c) notFound();

  const slots = (await getSlotInfo(id)) ?? [];
  const problems = startProblems({
    status: c.status,
    amount: c.amount,
    periods: c.periods,
    startDate: c.start_date,
    dueDay: c.due_day,
    orderMethod: c.order_method,
    slots,
  });
  const lastDue = formatDate(lastDueDate(c.start_date, c.periods, c.due_day));

  const money = (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping });
  const yes = (b: boolean) => (b ? "Yes" : "No");
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="agreement">
        <PrintButton>Print agreement</PrintButton>
      </CommitteeHeader>

      {created ? (
        <div className="note ok rise" role="status" style={{ marginBottom: 16 }}>
          <Icon name="check" />
          <span>
            Committee created. The agreement below is saved as the first entry in its history. Next, <Link href={`/committees/${id}/members`}>add the members</Link>.
          </span>
        </div>
      ) : null}
      {saved === "partly" ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorNote>
            The committee was created, but the reminder, display or visibility choices didn&rsquo;t save. They are at their defaults: check them here and set them again.
          </ErrorNote>
        </div>
      ) : null}

      <div className="two rise" style={{ ["--i" as string]: 2 }}>
        <div className="stack">
        <StatusPanel
          committeeId={id}
          status={c.status}
          problems={c.status === "forming" ? problems : []}
          startedInThePast={c.start_date < todayInPakistan()}
          startText={formatDate(c.start_date)}
          lastDueText={lastDue}
        />
        <section className="agreement">
          <h2>Agreement</h2>
          <p className="print-only sm" dir="auto">
            Committee agreement for {c.name}
          </p>
          <div className="list" style={{ padding: "0 18px" }}>
            <Row t="Instalment" v={`${money(c.amount)} per period`} />
            <Row t="Number of periods" v={`${c.periods}`} />
            <Row t="Starts" v={formatDate(c.start_date)} />
            <Row t="Due day, grace" v={`The ${ordinal(c.due_day)}, ${c.grace_days === 0 ? "no grace days" : `${days(c.grace_days)} grace`}`} />
            <Row t="Turn order" v={ORDER_LABELS[c.order_method as OrderMethod]} />
            <Row t="Reminders" v={`${days(c.remind_before_days)} before, then every ${days(c.remind_late_every)} when late`} />
          </div>
          <p className="sm mut" style={{ marginTop: 8 }}>
            Amount, number of periods and start date are fixed once the committee is running.
          </p>
        </section>
        </div>

        <div className="stack">
          <section>
            <h2>What members can see</h2>
            <div className="list" style={{ padding: "0 18px" }}>
              <Row t="Who has paid" v={yes(c.members_see_payments)} />
              <Row t="Whose turn it is" v={yes(c.members_see_turns)} />
              <Row t="The history" v={yes(c.members_see_history)} />
            </div>
            <p className="sm mut" style={{ marginTop: 8 }}>
              A member always sees their own turn, payments and receipts, and nothing about anyone else.
            </p>
          </section>
          <section>
            <h2>How amounts look</h2>
            <p className="note">
              <span>
                <b>{money(1200000)}</b> and <b>{money(c.amount)}</b>
              </span>
            </p>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}

function Row({ t, v }: { t: string; v: string }) {
  return (
    <div className="sw">
      <div className="t">{t}</div>
      <span dir="auto">{v}</span>
    </div>
  );
}
