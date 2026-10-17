"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { startCommittee, type StartState } from "@/app/(app)/committees/[id]/start-action";
import { CompletePanel } from "./CompletePanel";
import { Icon } from "./Icon";
import { useConfirmFocus } from "./useConfirmFocus";
import { ErrorNote } from "./states";

const STAGES = [
  ["forming", "Forming"],
  ["running", "Running"],
  ["completed", "Completed"],
] as const;

const initial: StartState = { problems: [], error: null, started: false };

type Props = {
  committeeId: string;
  status: "forming" | "running" | "completed";
  /** What stops the committee from starting right now (empty when it may start). Worked out on the server. */
  problems: string[];
  startedInThePast: boolean;
  startText: string;
  lastDueText: string;
  /** Only for a running committee: what is in the way of completing it. */
  completion?: { unrecorded: number; problems: string[]; problemsWithNote: string[] };
};

/** Where the committee is in its life, and the one button that moves it from forming to running. */
export function StatusPanel({ committeeId, status, problems, startedInThePast, startText, lastDueText, completion }: Props) {
  const [state, action, pending] = useActionState(startCommittee, initial);
  const [asking, setAsking] = useState(false);
  const { box, trigger } = useConfirmFocus(asking);
  const shown = state.problems.length > 0 ? state.problems : problems;
  const blocked = shown.length > 0;

  return (
    <section className="status" aria-labelledby="status-h">
      <h2 id="status-h">Status</h2>
      <ol className="stages" aria-label="Stages">
        {STAGES.map(([key, label], i) => (
          <li key={key} className={key === status ? "cur" : ""} aria-current={key === status ? "step" : undefined}>
            <span className="chip">{label}</span>
            {i < STAGES.length - 1 ? <span aria-hidden="true">→</span> : null}
          </li>
        ))}
      </ol>

      {status === "forming" ? (
        <form action={action}>
          <input type="hidden" name="committeeId" value={committeeId} />
          {state.error ? (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{state.error}</ErrorNote>
            </div>
          ) : null}

          {blocked ? (
            <div className="note warn" id="why" role="status">
              <Icon name="alert" />
              <div>
                <b>Can&rsquo;t start yet:</b>
                <ul className="problems">
                  {shown.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
                <Link href={`/committees/${committeeId}/members`}>Go to members and slots</Link>
              </div>
            </div>
          ) : (
            <>
              <p className="mut" style={{ marginBottom: 10 }}>
                {startedInThePast ? (
                  <>
                    This committee began on <b>{startText}</b>, so it will start as already running. You can then enter payments that already happened, with the date they really happened.
                  </>
                ) : (
                  <>
                    It starts on <b>{startText}</b>.
                  </>
                )}{" "}
                The last payment is due <b>{lastDueText}</b>.
              </p>
              {asking ? (
                <div className="note" role="group" aria-label="Confirm start" ref={box} tabIndex={-1}>
                  <Icon name="alert" />
                  <div>
                    <b>Start this committee?</b> Starting records the agreement in the history. After that the amount, number of periods and start date can&rsquo;t change, and slots and members can&rsquo;t be removed.
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <button className="btn primary" disabled={pending}>
                        {pending ? "Starting…" : "Yes, start it"}
                      </button>
                      <button className="btn secondary" type="button" onClick={() => setAsking(false)} disabled={pending}>
                        Not yet
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          <p className="sm mut" style={{ marginTop: 12 }}>
            A committee can only be completed after it has started.
          </p>
          {!asking ? (
            blocked ? (
              <button className="btn secondary" type="submit" disabled aria-describedby="why" style={{ marginTop: 12 }}>
                Start committee
              </button>
            ) : (
              <button className="btn primary" type="button" ref={trigger} onClick={() => setAsking(true)}>
                Start committee
              </button>
            )
          ) : null}
        </form>
      ) : status === "running" && completion ? (
        <CompletePanel
          committeeId={committeeId}
          unrecorded={completion.unrecorded}
          problems={completion.problems}
          problemsWithNote={completion.problemsWithNote}
          lastDueText={lastDueText}
        />
      ) : status === "running" ? (
        <p className="mut">
          This committee is running. The amount, number of periods and start date are fixed. The last payment is due <b>{lastDueText}</b>.
        </p>
      ) : (
        <p className="mut">This committee is completed. Its record is read-only.</p>
      )}
    </section>
  );
}
