"use client";

import { useActionState, useState } from "react";
import { saveOrder, type TurnState } from "@/app/(app)/committees/[id]/turns/actions";
import { moveBy, sameList } from "@/lib/turns";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: TurnState = { error: null, done: 0 };

export type EditorTurn = { id: string; label: string; note?: string };

type Props = {
  committeeId: string;
  /** Turns already paid out: they keep their places and cannot move (rule O4). */
  locked: EditorTurn[];
  /** Turns that can still move, in their current order. */
  movable: EditorTurn[];
};

/** Arrange the turns with up and down buttons (works the same with a finger or a mouse), then save once with a reason. */
export function TurnOrderEditor({ committeeId, locked, movable }: Props) {
  const [state, action, pending] = useActionState(saveOrder, initial);
  const original = movable.map((t) => t.id);
  const [arranged, setIds] = useState(original);
  // If the turns themselves changed (a member was added in another tab), start again from what is saved.
  const ids = arranged.length === original.length && arranged.every((id) => original.includes(id)) ? arranged : original;
  const byId = new Map(movable.map((t) => [t.id, t]));
  const changed = !sameList(ids, original);

  return (
    <form action={action} aria-label="Arrange the turns">
      <input type="hidden" name="committeeId" value={committeeId} />
      <input type="hidden" name="order" value={JSON.stringify(ids)} />
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}

      <ol className="list turns">
        {locked.map((t, i) => (
          <li key={t.id} className="li turn paid">
            <span className="pos" aria-label={`Turn ${i + 1}`}>
              {i + 1}
            </span>
            <span className="grow">
              <span className="t" dir="auto">
                {t.label}
              </span>
              <span className="s">Already paid out, so it stays here</span>
              {t.note ? (
                <span className="s" dir="auto">
                  {t.note}
                </span>
              ) : null}
            </span>
            <span className="lockmark" title="Paid out">
              <Icon name="lock" />
            </span>
          </li>
        ))}
        {ids.map((id, i) => {
          const t = byId.get(id);
          if (!t) return null;
          const place = locked.length + i + 1;
          return (
            <li key={id} className="li turn">
              <span className="pos" aria-label={`Turn ${place}`}>
                {place}
              </span>
              <span className="grow">
                <span className="t" dir="auto">
                  {t.label}
                </span>
                {t.note ? (
                  <span className="s" dir="auto">
                    {t.note}
                  </span>
                ) : null}
              </span>
              <span className="movers" role="group" aria-label={`Move ${t.label}`}>
                <button type="button" className="btn secondary small" aria-label={`Move ${t.label} earlier`} disabled={i === 0 || pending} onClick={() => setIds(moveBy(ids, i, -1))}>
                  <Icon name="up" />
                </button>
                <button type="button" className="btn secondary small" aria-label={`Move ${t.label} later`} disabled={i === ids.length - 1 || pending} onClick={() => setIds(moveBy(ids, i, 1))}>
                  <Icon name="down" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="order-reason">Reason (optional)</label>
        <input className="input" id="order-reason" name="reason" maxLength={200} autoComplete="off" dir="auto" placeholder="For example: agreed at the March meeting" />
        <span className="hint">It is written to the history with the new order.</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn primary" disabled={!changed || pending}>
          {pending ? "Saving…" : "Save order"}
        </button>
        {changed ? (
          <button type="button" className="btn secondary" disabled={pending} onClick={() => setIds(original)}>
            Undo changes
          </button>
        ) : null}
      </div>
    </form>
  );
}
