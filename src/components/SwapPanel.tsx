"use client";

import { useActionState, useState } from "react";
import { swapTurns, type TurnState } from "@/app/(app)/committees/[id]/turns/actions";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: TurnState = { error: null, done: 0 };

export type SwapChoice = { id: string; place: number; label: string };

/** Pick two turns that are not paid out yet, say why, and swap their places. Only the payout months change, never an amount. */
export function SwapPanel({ committeeId, choices }: { committeeId: string; choices: SwapChoice[] }) {
  const [state, action, pending] = useActionState(swapTurns, initial);
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  const options = (other: string) =>
    choices.map((c) => (
      <option key={c.id} value={c.id} disabled={c.id === other}>
        Turn {c.place} · {c.label}
      </option>
    ));

  return (
    <form action={action} aria-label="Swap two turns" className="card-form">
      <input type="hidden" name="committeeId" value={committeeId} />
      <h3>Swap two turns</h3>
      <p className="mut" style={{ marginBottom: 12 }}>
        When two members agree to change places. Only the payout months change. Every instalment stays the same.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="swap-a">First turn</label>
        <select className="input" id="swap-a" name="slotA" value={a} onChange={(e) => setA(e.target.value)} required>
          <option value="">Choose a turn</option>
          {options(b)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="swap-b">Second turn</label>
        <select className="input" id="swap-b" name="slotB" value={b} onChange={(e) => setB(e.target.value)} required>
          <option value="">Choose a turn</option>
          {options(a)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="swap-reason">Reason</label>
        <input className="input" id="swap-reason" name="reason" maxLength={200} autoComplete="off" dir="auto" required placeholder="For example: Sara asked for an earlier turn" />
        <span className="hint">It is written to the history.</span>
      </div>
      <button className="btn primary" disabled={pending || a === "" || b === ""}>
        <Icon name="shuffle" />
        {pending ? "Swapping…" : "Swap these turns"}
      </button>
    </form>
  );
}
