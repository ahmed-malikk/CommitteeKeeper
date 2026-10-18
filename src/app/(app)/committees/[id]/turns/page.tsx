import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { PageTransition } from "@/components/PageTransition";
import { TurnOrderEditor } from "@/components/TurnOrderEditor";
import { DrawPanel, MethodChanger } from "@/components/DrawPanel";
import { PayoutPanel } from "@/components/PayoutPanel";
import { SwapPanel } from "@/components/SwapPanel";
import { Icon } from "@/components/Icon";
import { ErrorNote } from "@/components/states";
import { ORDER_LABELS, type OrderMethod } from "@/lib/agreement";
import { formatDate, todayInPakistan } from "@/lib/dates";
import { getCommittee, getDrawHistory, getSwapHistory, getTurns } from "@/lib/dal";
import { formatRupees } from "@/lib/money";
import { describeDraw, describeSwap, inPlayOrder, payoutShares, potSplit } from "@/lib/turns";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `Turns · ${c.name}` : "Turns" };
}

const SAVED: Record<string, string> = {
  order: "Order saved.",
  drawn: "Drawn. The result is in the history below.",
  redrawn: "Redone. The earlier result stays in the history below.",
  method: "Saved. The way of deciding turns has changed.",
  swapped: "Swapped. The change is in the history below.",
  paidout: "Payout recorded. The turn is locked.",
};

export default async function TurnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const c = await getCommittee(id);
  if (!c) notFound();
  const [turns, history, swapHistory] = await Promise.all([getTurns(id, c.periods), getDrawHistory(id), getSwapHistory(id)]);

  const method = c.order_method as OrderMethod;
  const status = c.status as "forming" | "running" | "completed";
  const open = status !== "completed";
  const ordered = turns ? inPlayOrder(turns) : [];
  const locked = ordered.filter((t) => t.paidOut);
  const movable = ordered.filter((t) => !t.paidOut);

  const undrawn = ordered.filter((t) => t.position === null).length;
  const lastPlaced = [...ordered].reverse().find((t) => t.position !== null);
  const labelOf = new Map(ordered.map((t) => [t.id, t.label]));
  // A slot that changed hands shows how its pot will be split (rules L2, L3).
  const money = (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping });
  const splitNote = (holders: Parameters<typeof potSplit>[0]) => {
    const shares = potSplit(holders, c.amount, c.periods);
    return shares ? `Pot split: ${shares.map((s) => `${s.name} ${money(s.amount)}`).join(" · ")}` : undefined;
  };
  const lines = (history ?? []).map((e) => describeDraw(e, (slotId) => labelOf.get(slotId) ?? "a turn")).reverse();
  const swaps = (swapHistory ?? []).map((e) => describeSwap(e, (slotId) => labelOf.get(slotId) ?? "a turn")).reverse();
  // Turns that can swap: they have a place and are not paid out.
  const swappable = movable.filter((t) => t.position !== null).map((t) => ({ id: t.id, place: t.position as number, label: t.label }));

  // Turns that can be paid out: they have a place and have not been paid out yet, next in line first.
  const payable = movable
    .filter((t) => t.position !== null)
    .map((t) => {
      const shares = payoutShares(t.holders, c.amount, c.periods);
      return {
        id: t.id,
        place: t.position as number,
        label: t.label,
        potText: money(c.amount * c.periods),
        shares: shares ? shares.map((s) => ({ name: s.name, amountText: money(s.amount) })) : null,
      };
    });

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="turns" />

      {!turns ? (
        <ErrorNote>We couldn&rsquo;t load the turns. Check the connection and refresh the page.</ErrorNote>
      ) : (
        <div className="rise" style={{ ["--i" as string]: 2 }}>
          <div className="two">
            <section aria-labelledby="turns-h">
              <h2 id="turns-h">Turn order</h2>
              {saved && SAVED[saved] ? (
                <p className="note ok" role="status" style={{ marginBottom: 14 }}>
                  <Icon name="check" />
                  <span>{SAVED[saved]}</span>
                </p>
              ) : null}
              <p className="mut" style={{ marginBottom: 14 }}>
                Turns are decided by: <b>{ORDER_LABELS[method]}</b>.
              </p>

              {turns.length === 0 ? (
                <p className="mut">There are no turns yet. Give members slots on the Members page first.</p>
              ) : method === "hand" && open ? (
                <TurnOrderEditor
                  committeeId={id}
                  locked={locked.map((t) => ({ id: t.id, label: t.label, note: splitNote(t.holders) }))}
                  movable={movable.map((t) => ({ id: t.id, label: t.label, note: splitNote(t.holders) }))}
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
                        {splitNote(t.holders) ? (
                          <span className="s" dir="auto">
                            {splitNote(t.holders)}
                          </span>
                        ) : null}
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

            <div className="stack">
              {open && turns.length > 0 ? (
                <DrawPanel
                  committeeId={id}
                  method={method}
                  status={status}
                  turnsLeft={movable.length}
                  hasDrawn={lines.length > 0}
                  undrawn={undrawn}
                  canRedoLast={lastPlaced !== undefined && !lastPlaced.paidOut}
                />
              ) : null}
              {status === "running" && payable.length > 0 ? <PayoutPanel committeeId={id} choices={payable} today={todayInPakistan()} /> : null}
              {status === "running" && swappable.length >= 2 ? <SwapPanel committeeId={id} choices={swappable} /> : null}
              {open ? <MethodChanger committeeId={id} method={method} status={status} /> : null}

              {swaps.length > 0 ? (
                <section aria-labelledby="swaps-h">
                  <h2 id="swaps-h">Swap history</h2>
                  <ol className="list drawlog">
                    {swaps.map((l) => (
                      <li key={l.seq} className="li">
                        <span className="grow">
                          <span className="t">Turns swapped</span>
                          <span className="s" dir="auto">
                            {l.detail}
                          </span>
                          {l.reason ? (
                            <span className="s" dir="auto">
                              Reason: {l.reason}
                            </span>
                          ) : null}
                          <span className="s">{formatDate(l.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {lines.length > 0 ? (
                <section aria-labelledby="draws-h">
                  <h2 id="draws-h">Draw history</h2>
                  <ol className="list drawlog">
                    {lines.map((l) => (
                      <li key={l.seq} className="li">
                        <span className="grow">
                          <span className="t">{l.title}</span>
                          <span className="s" dir="auto">
                            {l.detail}
                          </span>
                          {l.reason ? (
                            <span className="s" dir="auto">
                              Reason: {l.reason}
                            </span>
                          ) : null}
                          <span className="s">{formatDate(l.date)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
