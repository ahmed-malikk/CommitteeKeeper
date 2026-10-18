"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { recordPayment, type PayState } from "@/app/(app)/committees/[id]/payments/actions";
import { METHODS, METHOD_LABELS, PAYMENT_NOTE_MAX } from "@/lib/payments";
import { RECEIPTS_PER_PAYMENT } from "@/lib/receipts";
import { uploadReceipt } from "@/lib/upload-receipt";
import type { HolderStretch } from "@/lib/turns";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: PayState = { error: null, problems: {}, paymentId: null, done: 0 };

export type PaySlot = { id: string; label: string; holders: HolderStretch[] };
export type PayPeriod = { period: number; label: string };

type Props = {
  committeeId: string;
  /** The full instalment, already formatted the way the organiser chose. */
  instalmentText: string;
  periods: PayPeriod[];
  slots: PaySlot[];
  /** "slotId|period" for every instalment that already has a payment that counts. */
  recorded: string[];
  today: string;
  defaults: { slotId: string; period: number };
};

/** Records one payment: who (the slot), which month, when it was paid and how. The amount is shown, never typed. */
export function PaymentForm(props: Props) {
  const [state, action, pending] = useActionState(recordPayment, initial);
  const router = useRouter();
  // The images chosen before saving; they can only be sent once the payment exists (and so has an id).
  const chosen = useRef<File[]>([]);
  const [sending, setSending] = useState(false);
  const [receiptNote, setReceiptNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const files = chosen.current;
    if (!state.paymentId) return;
    chosen.current = [];
    if (files.length === 0) return;
    (async () => {
      setSending(true);
      setReceiptNote(null);
      let attached = 0;
      for (const file of files) {
        const problem = await uploadReceipt(props.committeeId, state.paymentId as string, file);
        if (problem) {
          setReceiptNote({ ok: false, text: `The payment is saved, but a receipt was not attached: ${problem} You can add it from the payment's row.` });
          break;
        }
        attached++;
      }
      if (attached === files.length) setReceiptNote({ ok: true, text: `${attached} receipt${attached === 1 ? "" : "s"} attached.` });
      setSending(false);
      router.refresh();
    })();
    // Runs once per saved payment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.done]);
  // Submitted by hand, not with <form action>: React resets a form after its action, which would blank the controlled
  // fields on screen while their state still holds the old values (and would wipe what was typed after a refusal).
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReceiptNote(null);
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  }
  // A new key after each saved payment gives the fields back their starting values.
  return (
    <form onSubmit={submit} aria-label="Record a payment" className="card-form" id="record" noValidate>
      <input type="hidden" name="committeeId" value={props.committeeId} />
      <h3>Record a payment</h3>
      {state.paymentId ? (
        <p className="note ok" role="status" style={{ marginBottom: 12 }}>
          <Icon name="check" />
          <span>Saved. It is in the history.</span>
        </p>
      ) : null}
      {sending ? (
        <p className="note" role="status" style={{ marginBottom: 12 }}>
          <span>Attaching the receipt…</span>
        </p>
      ) : receiptNote ? (
        receiptNote.ok ? (
          <p className="note ok" role="status" style={{ marginBottom: 12 }}>
            <Icon name="check" />
            <span>{receiptNote.text}</span>
          </p>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <ErrorNote>{receiptNote.text}</ErrorNote>
          </div>
        )
      ) : null}
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <Fields key={`${state.done}-${props.defaults.slotId}-${props.defaults.period}`} {...props} problems={state.problems} pending={pending || sending} onFiles={(files) => (chosen.current = files)} />
    </form>
  );
}

function Fields({ instalmentText, periods, slots, recorded, today, defaults, problems, pending, onFiles }: Props & { problems: PayState["problems"]; pending: boolean; onFiles: (files: File[]) => void }) {
  const [slotId, setSlotId] = useState(defaults.slotId);
  const [period, setPeriod] = useState(String(defaults.period));
  // Controlled, so a refused entry keeps what was typed (a form's own reset after a submit would clear them).
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState<string>(METHODS[0]);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const slot = slots.find((s) => s.id === slotId);
  const p = Number(period);
  const holder = slot?.holders.find((h) => h.fromPeriod <= p && (h.toPeriod === null || h.toPeriod >= p));
  const already = slotId !== "" && recorded.includes(`${slotId}|${p}`);
  const monthOf = periods.find((x) => x.period === p)?.label ?? "";
  const bad = (key: keyof PayState["problems"]) => (problems[key] ? { "aria-invalid": true, "aria-describedby": `pay-${key}-err` } : {});
  const why = (key: keyof PayState["problems"]) =>
    problems[key] ? (
      <span className="hint bad" id={`pay-${key}-err`}>
        {problems[key]}
      </span>
    ) : null;

  return (
    <>
      <div className="field">
        <label htmlFor="pay-slot">Slot</label>
        <select className="input" id="pay-slot" name="slotId" value={slotId} onChange={(e) => setSlotId(e.target.value)} {...bad("slot")}>
          <option value="">Choose a slot</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {why("slot")}
      </div>

      <div className="field">
        <label htmlFor="pay-period">Month</label>
        <select className="input" id="pay-period" name="period" value={period} onChange={(e) => setPeriod(e.target.value)} {...bad("period")}>
          {periods.map((x) => (
            <option key={x.period} value={x.period}>
              {x.label} · period {x.period}
            </option>
          ))}
        </select>
        {why("period")}
      </div>

      {slotId !== "" ? (
        already ? (
          <p className="note warn" role="status" style={{ marginBottom: 16 }}>
            <Icon name="alert" />
            <span>
              A payment is already recorded for this slot in {monthOf}. To fix a mistake, correct that entry; a second payment can&rsquo;t be added.
            </span>
          </p>
        ) : (
          <p className="note" style={{ marginBottom: 16 }}>
            <span dir="auto">
              Paid by <b>{holder?.name ?? "nobody (this slot has no holder that month)"}</b> for {monthOf}: the full instalment, <b>{instalmentText}</b>.
            </span>
          </p>
        )
      ) : null}

      <div className="field">
        <label htmlFor="pay-date">Date paid</label>
        <input className="input" id="pay-date" name="paidOn" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} {...bad("paidOn")} />
        <span className="hint">The day the money really changed hands. An earlier date is fine; a future one isn&rsquo;t.</span>
        {why("paidOn")}
      </div>

      <div className="field">
        <span className="lbl" id="pay-method-l" style={{ fontWeight: 600 }}>
          Method
        </span>
        <div className="seg" role="radiogroup" aria-labelledby="pay-method-l">
          {METHODS.map((m) => (
            <span key={m} style={{ display: "contents" }}>
              <input type="radio" name="method" id={`pay-m-${m}`} value={m} checked={method === m} onChange={() => setMethod(m)} />
              <label htmlFor={`pay-m-${m}`}>{METHOD_LABELS[m]}</label>
            </span>
          ))}
        </div>
        {why("method")}
      </div>

      <div className="field">
        <label htmlFor="pay-note">Note (optional, only you see it)</label>
        <input className="input" id="pay-note" name="note" maxLength={PAYMENT_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" dir="auto" placeholder="For example: transaction number" {...bad("note")} />
        {why("note")}
      </div>

      <div className="field pickfile">
        <label htmlFor="pay-files">Receipt screenshots (optional, up to {RECEIPTS_PER_PAYMENT})</label>
        <input
          className="input"
          id="pay-files"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, RECEIPTS_PER_PAYMENT);
            onFiles(files);
            setPicked(files.map((f) => f.name));
          }}
        />
        <span className="hint">Large photos are shrunk on your phone first. They are stored privately: only you can open them.</span>
        {picked.length > 0 ? (
          <ul aria-label="Chosen images">
            {picked.map((n, i) => (
              <li key={i} dir="auto">
                {n}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <button className="btn primary" disabled={pending || already}>
        <Icon name="check" />
        {pending ? "Saving…" : "Save payment"}
      </button>
    </>
  );
}
