"use client";

import { useActionState, useState } from "react";
import { recordPayout, type TurnState } from "@/app/(app)/committees/[id]/turns/actions";
import { Icon } from "./Icon";
import { useConfirmFocus } from "./useConfirmFocus";
import { ErrorNote } from "./states";

const initial: TurnState = { error: null, done: 0 };

export type PayoutChoice = {
  id: string;
  place: number;
  label: string;
  /** The pot, already formatted in the committee's style. */
  potText: string;
  /** Who receives what; more than one line when the slot changed hands. Null when the split can't be worked out. */
  shares: { name: string; amountText: string }[] | null;
};

/** Records that a turn's pot was handed over: pick the turn and the day, see who gets what, confirm. The turn is then locked. */
export function PayoutPanel({ committeeId, choices, today }: { committeeId: string; choices: PayoutChoice[]; today: string }) {
  const [state, action, pending] = useActionState(recordPayout, initial);
  const [slotId, setSlotId] = useState(choices[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(today);
  const [asking, setAsking] = useState(false);
  const { box, trigger } = useConfirmFocus(asking);
  const chosen = choices.find((c) => c.id === slotId);

  if (choices.length === 0) return null;
  return (
    <form action={action} aria-label="Record a payout" className="card-form">
      <input type="hidden" name="committeeId" value={committeeId} />
      <h3>Record a payout</h3>
      <p className="mut" style={{ marginBottom: 12 }}>
        When a member has been handed the pot for their turn. The turn is then locked and cannot move or be paid out again.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="payout-slot">Turn</label>
        <select className="input" id="payout-slot" name="slotId" value={slotId} onChange={(e) => { setSlotId(e.target.value); setAsking(false); }} disabled={pending}>
          {choices.map((c) => (
            <option key={c.id} value={c.id}>
              Turn {c.place} · {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="payout-date">Date handed over</label>
        <input className="input" id="payout-date" name="paidOn" type="date" max={today} value={paidOn} onChange={(e) => { setPaidOn(e.target.value); setAsking(false); }} disabled={pending} required />
      </div>

      {chosen ? (
        <div className="payout-split" aria-live="polite">
          <span className="s">The pot is <b>{chosen.potText}</b>.</span>
          {chosen.shares ? (
            <ul className="problems">
              {chosen.shares.map((s) => (
                <li key={s.name} dir="auto">
                  {s.name} receives <b>{s.amountText}</b>
                </li>
              ))}
            </ul>
          ) : (
            <span className="s">The split can’t be worked out because this turn’s holders don’t cover every month.</span>
          )}
        </div>
      ) : null}

      {asking && chosen?.shares ? (
        <div className="note" role="group" aria-label="Confirm payout" ref={box} tabIndex={-1} style={{ marginTop: 12 }}>
          <Icon name="alert" />
          <div>
            <b>Record this payout?</b> It is written to the history and the turn is locked. This cannot be undone.
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={pending}>
                {pending ? "Recording…" : "Yes, record it"}
              </button>
              <button className="btn secondary" type="button" onClick={() => setAsking(false)} disabled={pending}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn primary" type="button" ref={trigger} onClick={() => setAsking(true)} disabled={!chosen?.shares || paidOn === "" || pending} style={{ marginTop: 12 }}>
          <Icon name="cash" />
          Record payout
        </button>
      )}
    </form>
  );
}
