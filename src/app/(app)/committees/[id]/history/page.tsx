import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PrintButton } from "@/components/PrintButton";
import { EmptyState, ErrorNote } from "@/components/states";
import { getCommittee, getCurrentUser, getHistory, getReceipts, getTurns } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { chainStatus, describeEvent, formatRecorded, shortHash } from "@/lib/history";
import { formatRupees } from "@/lib/money";
import { periodLabel } from "@/lib/payments";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `History · ${c.name}` : "History" };
}

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  if (!c) notFound();

  const supabase = await createClient();
  const [history, turns, receipts, chain, user] = await Promise.all([
    getHistory(id),
    getTurns(id, c.periods),
    getReceipts(id),
    supabase.rpc("verify_chain", { p_committee_id: id }),
    getCurrentUser(),
  ]);

  if (!history || !turns) {
    return (
      <PageTransition>
        <CommitteeHeader committee={c} active="history" />
        <ErrorNote>We couldn&rsquo;t load the history. Check the connection and refresh the page.</ErrorNote>
      </PageTransition>
    );
  }

  const status = chainStatus(chain.error ? null : (chain.data as string));
  const slotLabel = new Map(turns.map((t) => [t.id, t.label]));
  const look = {
    member: (memberId: string) => history.members.get(memberId) ?? "A member",
    slot: (slotId: string) => slotLabel.get(slotId) ?? "a turn",
    money: (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping }),
    period: (n: number) => periodLabel(c.start_date, n),
  };
  const entries = [...history.events].reverse();
  const actor = (actorId: string | null) => (actorId === null ? "The daily reminder job" : actorId === user?.id ? "You" : "Another organiser");

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="history" />

      <div className="rise" style={{ ["--i" as string]: 2 }}>
        <section aria-labelledby="chain-h" className="chain">
          <h2 id="chain-h">Is the history intact?</h2>
          {status.ok ? (
            <p className="note ok" role="status">
              <Icon name="shield" />
              <span>
                <b>{status.text}</b> {history.events.length} entr{history.events.length === 1 ? "y" : "ies"} checked just now.
              </span>
            </p>
          ) : (
            <p className="note warn" role="alert">
              <Icon name="alert" />
              <span>
                <b>The check found a problem.</b> {status.text}
              </span>
            </p>
          )}
          <p className="mut sm" style={{ marginTop: 8 }}>
            Each entry carries a fingerprint worked out from its contents and the fingerprint of the entry before it. The check recomputes every one. It proves nothing was changed, removed or slipped in between entries after they were written. It can&rsquo;t prove that what was typed in the first place was true.
          </p>
        </section>

        <div className="histbar">
          <h2 id="hist-h" style={{ margin: 0 }}>
            Everything that happened <span className="mut sm">newest first</span>
          </h2>
          <PrintButton>Print or save as PDF</PrintButton>
        </div>

        {entries.length === 0 ? (
          <EmptyState title="Nothing has happened yet">Every change to this committee will be listed here, in order, and can never be edited or removed.</EmptyState>
        ) : (
          <ol className="list hist" aria-labelledby="hist-h">
            {entries.map((e) => {
              const line = describeEvent(e, look);
              const paymentId = typeof e.payload.payment_id === "string" ? e.payload.payment_id : null;
              const attached = paymentId && (e.type === "payment_recorded" || e.type === "payment_corrected") ? (receipts?.get(paymentId)?.length ?? 0) : 0;
              return (
                <li key={e.seq} id={`entry-${e.seq}`}>
                  <span className="no" aria-label={`Entry ${e.seq}`}>
                    #{e.seq}
                  </span>
                  <div className="body">
                    <span className="t">{line.title}</span>
                    {line.detail ? (
                      <span className="s" dir="auto">
                        {line.detail}
                      </span>
                    ) : null}
                    {line.reason ? (
                      <span className="s" dir="auto">
                        Reason: {line.reason}
                      </span>
                    ) : null}
                    {e.correctsSeq !== null ? (
                      <span className="s fix">
                        Corrects entry <a href={`#entry-${e.correctsSeq}`}>#{e.correctsSeq}</a>. The original stays as it was.
                      </span>
                    ) : null}
                    {attached > 0 ? (
                      <span className="s">
                        Receipts: {attached} attached
                      </span>
                    ) : null}
                    <span className="s">
                      Happened {formatDate(e.happenedOn)} &middot; recorded {formatRecorded(e.recordedAt)} &middot; by {actor(e.actorId)}
                    </span>
                    <span className="s">
                      Fingerprint <span className="fp">{shortHash(e.hash)}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </PageTransition>
  );
}
