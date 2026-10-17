import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PrintButton } from "@/components/PrintButton";
import { ErrorNote } from "@/components/states";
import { ORDER_LABELS, type OrderMethod } from "@/lib/agreement";
import { formatDate, ordinal } from "@/lib/dates";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_CLASS = { forming: "form", running: "run", completed: "done" } as const;
const STATUS_TEXT = { forming: "Forming", running: "Running", completed: "Completed" } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Committee" };
  const supabase = await createClient();
  const { data } = await supabase.from("committees").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Committee" };
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
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  // A committee that belongs to someone else is invisible to this query, so it looks exactly like one that does not exist.
  const { data: c } = await supabase.from("committees").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const money = (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping });
  const status = c.status as keyof typeof STATUS_CLASS;
  const yes = (b: boolean) => (b ? "Yes" : "No");
  const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

  return (
    <PageTransition>
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
              {money(c.amount)} &middot; {c.periods} periods &middot; starts {formatDate(c.start_date)}
            </span>
          </div>
        </div>
        <PrintButton>Print agreement</PrintButton>
      </div>

      {created ? (
        <div className="note ok rise" role="status" style={{ marginBottom: 16 }}>
          <Icon name="check" />
          <span>Committee created. The agreement below is saved as the first entry in its history.</span>
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
