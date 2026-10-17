"use client";

import { useActionState, useState } from "react";
import { completeCommittee, type CompleteState } from "@/app/(app)/committees/[id]/complete-action";
import { SETTLEMENT_NOTE_MAX } from "@/lib/committee";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: CompleteState = { problems: [], error: null, completed: false };

type Props = {
  committeeId: string;
  /** Instalments with no payment recorded. They need a written note about how they were settled. */
  unrecorded: number;
  /** What stops the committee from being completed, worked out on the server with no note, and with a note. */
  problems: string[];
  problemsWithNote: string[];
  lastDueText: string;
};

/** The way to finish a committee: lists what is still in the way, asks for a settlement note when payments are missing, and confirms. */
export function CompletePanel({ committeeId, unrecorded, problems, problemsWithNote, lastDueText }: Props) {
  const [state, action, pending] = useActionState(completeCommittee, initial);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  const fromServer = state.problems.length > 0 ? state.problems : null;
  const shown = fromServer ?? (note.trim() === "" ? problems : problemsWithNote);
  const blocked = shown.length > 0;

  return (
    <form action={action} aria-label="Complete this committee">
      <input type="hidden" name="committeeId" value={committeeId} />
      <p className="mut" style={{ marginBottom: 10 }}>
        This committee is running. The last payment is due <b>{lastDueText}</b>. When it is over and every turn has been paid out, you can complete it. A completed committee is read-only.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}

      {unrecorded > 0 ? (
        <div className="field">
          <label htmlFor="settlement-note">How were the {unrecorded} unrecorded payments settled?</label>
          <textarea
            className="input"
            id="settlement-note"
            name="settlementNote"
            rows={3}
            maxLength={SETTLEMENT_NOTE_MAX}
            dir="auto"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: everyone paid in cash at the monthly meeting"
          />
          <span className="hint">Needed only while payments are missing. It is written to the history.</span>
        </div>
      ) : null}

      {blocked ? (
        <div className="note warn" id="complete-why" role="status">
          <Icon name="alert" />
          <div>
            <b>Can&rsquo;t complete yet:</b>
            <ul className="problems">
              {shown.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : asking ? (
        <div className="note" role="group" aria-label="Confirm completion">
          <Icon name="alert" />
          <div>
            <b>Complete this committee?</b> Its record becomes read-only. Nothing in it can be changed afterwards, and this cannot be undone.
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn primary" disabled={pending}>
                {pending ? "Completing…" : "Yes, complete it"}
              </button>
              <button className="btn secondary" type="button" onClick={() => setAsking(false)} disabled={pending}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!asking ? (
        blocked ? (
          <button className="btn secondary" type="submit" disabled aria-describedby="complete-why" style={{ marginTop: 12 }}>
            Complete committee
          </button>
        ) : (
          <button className="btn primary" type="button" onClick={() => setAsking(true)}>
            Complete committee
          </button>
        )
      ) : null}
    </form>
  );
}
