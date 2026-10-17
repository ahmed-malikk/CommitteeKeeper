"use client";

import { useActionState } from "react";
import { changeMethod, drawAll, drawNext, type TurnState } from "@/app/(app)/committees/[id]/turns/actions";
import { ORDER_HELP, ORDER_LABELS, type OrderMethod } from "@/lib/agreement";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: TurnState = { error: null, done: 0 };

type Props = {
  committeeId: string;
  method: OrderMethod;
  status: "forming" | "running" | "completed";
  /** Turns that could still be given a place (not paid out). */
  turnsLeft: number;
  /** Turns with a place that is not paid out and not locked in. */
  hasDrawn: boolean;
  /** Month-by-month: turns without a place yet. */
  undrawn: number;
  /** Month-by-month: the last drawn turn can be redone (it is not paid out). */
  canRedoLast: boolean;
};

function Reason({ id, required }: { id: string; required?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={id}>{required ? "Reason" : "Reason (optional)"}</label>
      <input className="input" id={id} name="reason" maxLength={200} autoComplete="off" dir="auto" required={required} placeholder="For example: agreed by everyone at the meeting" />
      <span className="hint">It is written to the history.</span>
    </div>
  );
}

/** Draw all turns at the start, or draw them one month at a time. Every draw and every redo stays in the history. */
export function DrawPanel({ committeeId, method, status, turnsLeft, hasDrawn, undrawn, canRedoLast }: Props) {
  const [allState, doAll, allPending] = useActionState(drawAll, initial);
  const [nextState, doNext, nextPending] = useActionState(drawNext, initial);

  const hidden = <input type="hidden" name="committeeId" value={committeeId} />;

  if (method === "draw_start") {
    return (
      <form action={doAll} aria-label="Draw all turns" className="card-form">
        {hidden}
        {hasDrawn ? <input type="hidden" name="redo" value="1" /> : null}
        <h3>{hasDrawn ? "Redo the draw" : "Draw all turns"}</h3>
        <p className="mut" style={{ marginBottom: 12 }}>
          {hasDrawn
            ? "A new draw replaces the places below. The earlier result stays in the history, so nobody can say it was hidden."
            : "Every turn gets a place by chance. The computer picks with a secure random source, and the result is written to the history."}
          {status === "running" ? " Turns already paid out keep their places." : ""}
        </p>
        {allState.error ? (
          <div style={{ marginBottom: 12 }}>
            <ErrorNote>{allState.error}</ErrorNote>
          </div>
        ) : null}
        {hasDrawn ? <Reason id="draw-all-reason" /> : null}
        <button className={`btn ${hasDrawn ? "secondary" : "primary"}`} disabled={allPending || turnsLeft === 0}>
          <Icon name="shuffle" />
          {allPending ? "Drawing…" : hasDrawn ? "Redo the draw" : "Draw all turns"}
        </button>
      </form>
    );
  }

  if (method === "draw_monthly") {
    if (status === "forming") {
      return (
        <p className="note">
          <Icon name="shuffle" />
          <span>Turns are drawn one month at a time. The drawing starts once the committee is running.</span>
        </p>
      );
    }
    return (
      <div className="stack">
        <form action={doNext} aria-label="Draw the next turn" className="card-form">
          {hidden}
          <h3>Draw the next turn</h3>
          <p className="mut" style={{ marginBottom: 12 }}>
            {undrawn > 0
              ? `${undrawn} ${undrawn === 1 ? "turn has" : "turns have"} no place yet. One of them is picked by chance and gets the next place. Turns already drawn are never drawn again.`
              : "Every turn has its place, so there is nothing left to draw."}
          </p>
          {nextState.error ? (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{nextState.error}</ErrorNote>
            </div>
          ) : null}
          <button className="btn primary" disabled={nextPending || undrawn === 0 || status !== "running"}>
            <Icon name="shuffle" />
            {nextPending ? "Drawing…" : "Draw the next turn"}
          </button>
        </form>

        {canRedoLast ? <RedoLast committeeId={committeeId} /> : null}
      </div>
    );
  }

  return null;
}

/** Throws away the last drawn turn and draws again, with a reason. Needs its own action state so the two forms do not share errors. */
function RedoLast({ committeeId }: { committeeId: string }) {
  const [state, action, pending] = useActionState(drawNext, initial);
  return (
    <form action={action} aria-label="Redo the last draw" className="card-form">
      <input type="hidden" name="committeeId" value={committeeId} />
      <input type="hidden" name="redo" value="1" />
      <h3>Redo the last draw</h3>
      <p className="mut" style={{ marginBottom: 12 }}>
        Use this only if the last turn was drawn by mistake. The earlier result stays in the history.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <Reason id="redo-reason" />
      <button className="btn secondary" disabled={pending}>
        {pending ? "Redrawing…" : "Redo the last draw"}
      </button>
    </form>
  );
}

/** Change how turns are decided. While running, the change needs a reason. */
export function MethodChanger({ committeeId, method, status }: { committeeId: string; method: OrderMethod; status: "forming" | "running" | "completed" }) {
  const [state, action, pending] = useActionState(changeMethod, initial);
  return (
    <details className="edit methodchange">
      <summary className="btn ghost small">Change how turns are decided</summary>
      <form action={action} aria-label="Change how turns are decided">
        <input type="hidden" name="committeeId" value={committeeId} />
        {state.error ? (
          <div style={{ marginBottom: 12 }}>
            <ErrorNote>{state.error}</ErrorNote>
          </div>
        ) : null}
        <div className="stack" role="radiogroup" aria-label="How turns are decided" style={{ marginBottom: 16 }}>
          {(Object.keys(ORDER_LABELS) as OrderMethod[]).map((m) => (
            <label key={m} className="li choice">
              <input type="radio" name="method" value={m} defaultChecked={m === method} />
              <span className="grow">
                <span className="t">{ORDER_LABELS[m]}</span>
                <span className="s">{ORDER_HELP[m]}</span>
              </span>
            </label>
          ))}
        </div>
        <Reason id="method-reason" required={status === "running"} />
        <button className="btn primary small" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </details>
  );
}
