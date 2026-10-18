"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { correctPayment, type CorrectState } from "@/app/(app)/committees/[id]/payments/actions";
import { CORRECTION_REASON_MAX, METHODS, METHOD_LABELS, PAYMENT_NOTE_MAX } from "@/lib/payments";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: CorrectState = { error: null, problems: {}, done: 0 };

type Props = {
  committeeId: string;
  paymentId: string;
  who: string;
  month: string;
  paidOn: string;
  method: string;
  today: string;
};

/**
 * Fixes a wrong payment without editing it: the correction is a new entry that points to the original, both stay in the
 * history, and a reason is required. "Cancel this payment" is the same thing with the payment voided.
 */
export function CorrectPayment({ committeeId, paymentId, who, month, paidOn: wasPaidOn, method: wasMethod, today }: Props) {
  const [state, action, pending] = useActionState(correctPayment, initial);
  const [open, setOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(wasPaidOn);
  const [method, setMethod] = useState(wasMethod);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [cancel, setCancel] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const seen = useRef(0);

  // A saved correction refreshes the page, which shows the new state; nothing to keep open here.
  useEffect(() => {
    if (state.done > seen.current) {
      seen.current = state.done;
      setOpen(false);
    }
  }, [state.done]);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }
  const bad = (key: keyof CorrectState["problems"]) => (state.problems[key] ? { "aria-invalid": true, "aria-describedby": `fix-${paymentId}-${key}` } : {});
  const why = (key: keyof CorrectState["problems"]) =>
    state.problems[key] ? (
      <span className="hint bad" id={`fix-${paymentId}-${key}`}>
        {state.problems[key]}
      </span>
    ) : null;

  if (!open) {
    return (
      <button className="btn ghost small fixopen" type="button" ref={opener} onClick={() => setOpen(true)} aria-label={`Correct or cancel the payment of ${who} for ${month}`}>
        Correct or cancel
      </button>
    );
  }
  return (
    <form onSubmit={submit} aria-label={`Correct the payment of ${who}`} className="fixform">
      <input type="hidden" name="committeeId" value={committeeId} />
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="cancel" value={cancel ? "yes" : "no"} />
      <p className="mut" style={{ marginBottom: 10 }}>
        Nothing is erased. The correction is added to the history and points to the original entry; both stay visible.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 10 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`fix-date-${paymentId}`}>Date paid</label>
        <input className="input" id={`fix-date-${paymentId}`} name="paidOn" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} ref={first} disabled={pending} {...bad("paidOn")} />
        {why("paidOn")}
      </div>
      <div className="field">
        <label htmlFor={`fix-method-${paymentId}`}>Method</label>
        <select className="input" id={`fix-method-${paymentId}`} name="method" value={method} onChange={(e) => setMethod(e.target.value)} disabled={pending} {...bad("method")}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
        {why("method")}
      </div>
      <div className="field">
        <label htmlFor={`fix-note-${paymentId}`}>Note (optional, only you see it)</label>
        <input className="input" id={`fix-note-${paymentId}`} name="note" maxLength={PAYMENT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" dir="auto" disabled={pending} {...bad("note")} />
        {why("note")}
      </div>
      <div className="field">
        <label htmlFor={`fix-reason-${paymentId}`}>{cancel ? "Why is it being cancelled?" : "What was wrong?"}</label>
        <input
          className="input"
          id={`fix-reason-${paymentId}`}
          name="reason"
          maxLength={CORRECTION_REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoComplete="off"
          dir="auto"
          disabled={pending}
          placeholder={cancel ? "For example: recorded against the wrong member" : "For example: typed the wrong day"}
          {...bad("reason")}
        />
        <span className="hint">It is written to the history.</span>
        {why("reason")}
      </div>
      <label className="check">
        <input type="checkbox" checked={cancel} onChange={(e) => setCancel(e.target.checked)} disabled={pending} />
        <span>Cancel this payment instead (it was recorded by mistake and the instalment is unpaid again)</span>
      </label>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button className={cancel ? "btn danger" : "btn primary"} disabled={pending}>
          <Icon name="check" />
          {pending ? "Saving…" : cancel ? "Cancel the payment" : "Save the correction"}
        </button>
        <button
          className="btn secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setTimeout(() => opener.current?.focus(), 0);
          }}
        >
          Keep it as it is
        </button>
      </div>
    </form>
  );
}
