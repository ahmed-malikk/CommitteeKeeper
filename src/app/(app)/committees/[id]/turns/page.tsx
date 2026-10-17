import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { PageTransition } from "@/components/PageTransition";
import { TurnOrderEditor } from "@/components/TurnOrderEditor";
import { Icon } from "@/components/Icon";
import { ErrorNote } from "@/components/states";
import { ORDER_LABELS, type OrderMethod } from "@/lib/agreement";
import { getCommittee, getTurns } from "@/lib/dal";
import { inPlayOrder } from "@/lib/turns";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `Turns · ${c.name}` : "Turns" };
}

export default async function TurnsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const c = await getCommittee(id);
  if (!c) notFound();
  const turns = await getTurns(id, c.periods);

  const open = c.status !== "completed";
  const ordered = turns ? inPlayOrder(turns) : [];
  const locked = ordered.filter((t) => t.paidOut);
  const movable = ordered.filter((t) => !t.paidOut);

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="turns" />

      {!turns ? (
        <ErrorNote>We couldn&rsquo;t load the turns. Check the connection and refresh the page.</ErrorNote>
      ) : (
        <div className="rise" style={{ ["--i" as string]: 2 }}>
          <section aria-labelledby="turns-h">
            <h2 id="turns-h">Turn order</h2>
            {saved === "order" ? (
              <p className="note ok" role="status" style={{ marginBottom: 14 }}>
                <Icon name="check" />
                <span>Order saved.</span>
              </p>
            ) : null}
            <p className="mut" style={{ marginBottom: 14 }}>
              Turns are decided by: <b>{ORDER_LABELS[c.order_method as OrderMethod]}</b>.
            </p>

            {turns.length === 0 ? (
              <p className="mut">There are no turns yet. Give members slots on the Members page first.</p>
            ) : c.order_method === "hand" && open ? (
              <TurnOrderEditor
                committeeId={id}
                locked={locked.map((t) => ({ id: t.id, label: t.label }))}
                movable={movable.map((t) => ({ id: t.id, label: t.label }))}
              />
            ) : (
              <ol className="list turns">
                {ordered.map((t) => (
                  <li key={t.id} className={`li turn${t.paidOut ? " paid" : ""}`}>
                    <span className="pos">{t.position ?? "–"}</span>
                    <span className="grow">
                      <span className="t" dir="auto">
                        {t.label}
                      </span>
                      {t.position === null ? <span className="s">No place yet</span> : t.paidOut ? <span className="s">Paid out</span> : null}
                    </span>
                    {t.paidOut ? (
                      <span className="lockmark">
                        <Icon name="lock" />
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </PageTransition>
  );
}
