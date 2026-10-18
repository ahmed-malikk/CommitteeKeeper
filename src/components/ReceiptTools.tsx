"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { removeReceipt } from "@/app/(app)/committees/[id]/payments/actions";
import { RECEIPTS_PER_PAYMENT } from "@/lib/receipts";
import { uploadReceipt } from "@/lib/upload-receipt";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

type Props = {
  committeeId: string;
  paymentId: string;
  who: string;
  receipts: { id: string; slotNo: number }[];
  /** False once the committee is completed: receipts can be opened but not added or removed. */
  editable: boolean;
};

/** The receipts of one payment: open, remove, or add (up to 2). Opening goes through a link that works for a minute. */
export function ReceiptTools({ committeeId, paymentId, who, receipts, editable }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    const room = RECEIPTS_PER_PAYMENT - receipts.length;
    const chosen = Array.from(files).slice(0, room);
    for (const file of chosen) {
      const problem = await uploadReceipt(committeeId, paymentId, file);
      if (problem) {
        setError(problem);
        break;
      }
    }
    if (files.length > room) setError(`Only ${RECEIPTS_PER_PAYMENT} receipts fit on one payment. The extra images were not attached.`);
    if (input.current) input.current.value = "";
    setBusy(false);
    router.refresh();
  }

  function remove(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await removeReceipt(committeeId, id);
      setAsking(null);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (receipts.length === 0 && !editable) return null;
  return (
    <div className="receipts">
      {receipts.map((r) => (
        <span className="rc" key={r.id}>
          <Icon name="image" />
          <a href={`/committees/${committeeId}/receipts/${r.id}`} target="_blank" rel="noopener" aria-label={`Open receipt ${r.slotNo} for ${who}`}>
            Receipt {r.slotNo}
          </a>
          {editable ? (
            asking === r.id ? (
              <span className="rc-ask" role="group" aria-label={`Remove receipt ${r.slotNo}?`}>
                <button type="button" className="btn small danger" onClick={() => remove(r.id)}>
                  Remove it
                </button>
                <button type="button" className="btn ghost small" onClick={() => setAsking(null)}>
                  Keep
                </button>
              </span>
            ) : (
              <button type="button" className="btn ghost small" onClick={() => setAsking(r.id)} aria-label={`Remove receipt ${r.slotNo} for ${who}`}>
                <Icon name="x" />
              </button>
            )
          ) : null}
        </span>
      ))}
      {editable && receipts.length < RECEIPTS_PER_PAYMENT ? (
        <>
          <input ref={input} id={`rc-${paymentId}`} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple={receipts.length === 0} onChange={(e) => add(e.target.files)} disabled={busy} aria-label={`Add a receipt image for ${who}`} />
          <label htmlFor={`rc-${paymentId}`} className="btn ghost small" aria-disabled={busy}>
            <Icon name="plus" />
            {busy ? "Attaching…" : receipts.length === 0 ? "Add receipt" : "Add another"}
          </label>
        </>
      ) : null}
      {error ? (
        <div style={{ flexBasis: "100%" }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}
    </div>
  );
}
