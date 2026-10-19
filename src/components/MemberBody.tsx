import { Icon } from "./Icon";
import { formatDate, ordinal } from "@/lib/dates";
import { historyWords, progressText, turnText, type MemberView } from "@/lib/member-view";
import { METHOD_LABELS, periodLabel, type Method } from "@/lib/payments";
import { formatRupees } from "@/lib/money";

const STATUS_CLASS = { forming: "form", running: "run", completed: "done" } as const;
const STATUS_TEXT = { forming: "Forming", running: "Running", completed: "Completed" } as const;

/**
 * What a member sees on their own page: their own turn or turns, the months left and the committee's status, always;
 * the order of turns, who has paid this month and the entries about them only when the organiser allowed it.
 * The database decides what is in `view`; this component only shows what it was given.
 */
export function MemberBody({ view, receiptHref }: { view: MemberView; receiptHref?: (paymentId: string, n: number) => string }) {
  const c = view.committee;
  const money = (n: number) => formatRupees(n, { style: c.display_style, grouping: c.display_grouping });
  return (
    <div className="mview">
      <header className="mhero">
        <h1 dir="auto">{c.name}</h1>
        <p className="mut" dir="auto">
          Hello {view.me.name}.
        </p>
        <p className="mstatus">
          <span className={`chip ${STATUS_CLASS[c.status]}`}>{STATUS_TEXT[c.status]}</span>
          <span>{progressText(view)}</span>
        </p>
      </header>

      <section aria-labelledby="mturn-h" className="mblock">
        <h2 id="mturn-h">{view.my_slots.length === 1 ? "Your turn" : "Your turns"}</h2>
        {view.my_slots.length === 0 ? (
          <p className="mut">You don&rsquo;t have a turn in this committee yet.</p>
        ) : (
          <ul className="list">
            {view.my_slots.map((slot, i) => (
              <li className="li" key={slot.slot_id}>
                <span className="grow">
                  <span className="t">{view.my_slots.length > 1 ? `Slot ${i + 1}` : "Your slot"}</span>
                  <span className="s">{turnText(slot, c.start_date)}</span>
                </span>
                {slot.paid_out ? (
                  <span className="chip paid">
                    <Icon name="check" />
                    Paid out
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mpay-h" className="mblock">
        <h2 id="mpay-h">Your payments</h2>
        {view.my_payments.length === 0 ? (
          <p className="mut">No payments are recorded for you yet.</p>
        ) : (
          <ul className="list">
            {view.my_payments.map((p) => (
              <li className="li" key={p.payment_id}>
                <span className="grow">
                  <span className="t">
                    {periodLabel(c.start_date, p.period)} &middot; {money(p.amount)}
                  </span>
                  <span className="s">
                    Paid {formatDate(p.paid_on)} &middot; {METHOD_LABELS[p.method as Method] ?? p.method}
                  </span>
                  {p.receipts > 0 ? (
                    <span className="s mreceipts">
                      {receiptHref ? (
                        Array.from({ length: p.receipts }, (_, i) => (
                          <a key={i} href={receiptHref(p.payment_id, i + 1)} target="_blank" rel="noopener noreferrer" aria-label={`Open receipt ${i + 1} for ${periodLabel(c.start_date, p.period)}`}>
                            <Icon name="image" />
                            Receipt {i + 1}
                          </a>
                        ))
                      ) : (
                        <>
                          {p.receipts} receipt{p.receipts === 1 ? "" : "s"}
                        </>
                      )}
                    </span>
                  ) : null}
                </span>
                <span className="chip paid">
                  <Icon name="check" />
                  Paid
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="mterms-h" className="mblock">
        <h2 id="mterms-h">The agreement</h2>
        <p>
          Each month: <b>{money(c.amount)}</b> for every slot, due on the {ordinal(c.due_day)}
          {c.grace_days > 0 ? `, with ${c.grace_days} grace day${c.grace_days === 1 ? "" : "s"}` : ""}. It runs for {c.periods} months from {formatDate(c.start_date)}.
        </p>
      </section>

      {view.all_turns ? (
        <section aria-labelledby="morder-h" className="mblock">
          <h2 id="morder-h">Order of turns</h2>
          <ol className="list turns">
            {view.all_turns.map((t, i) => (
              <li key={i} className={`li turn${t.paid_out ? " paid" : ""}`}>
                <span className="pos">{t.position ?? "–"}</span>
                <span className="grow">
                  <span className="t" dir="auto">
                    {t.is_me ? "You" : t.holder}
                  </span>
                  {t.paid_out ? <span className="s">Paid out</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {view.payment_status ? (
        <section aria-labelledby="mpaid-h" className="mblock">
          <h2 id="mpaid-h">Who has paid this month</h2>
          {view.payment_status.length === 0 ? (
            <p className="mut">Nothing to show yet.</p>
          ) : (
            <ul className="list">
              {view.payment_status.map((p, i) => (
                <li className="li" key={i}>
                  <span className="grow">
                    <span className="t" dir="auto">
                      {p.is_me ? "You" : p.holder}
                    </span>
                  </span>
                  <span className={`chip ${p.paid ? "paid" : ""}`}>{p.paid ? "Paid" : "Not yet"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {view.history ? (
        <section aria-labelledby="mhist-h" className="mblock">
          <h2 id="mhist-h">What the record says about you</h2>
          {view.history.length === 0 ? (
            <p className="mut">Nothing yet.</p>
          ) : (
            <ul className="list">
              {view.history.map((h) => (
                <li className="li" key={h.seq}>
                  <span className="grow">
                    <span className="t">{historyWords(h.type)}</span>
                    <span className="s">{formatDate(h.happened_on)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
