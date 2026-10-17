"use client";

import { useActionState, useState } from "react";
import { replaceHolder, type MemberState } from "@/app/(app)/committees/[id]/members/actions";
import { formatRupees, type DisplayGrouping, type DisplayStyle } from "@/lib/money";
import { previewReplacement, type HolderStretch } from "@/lib/turns";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: MemberState = { error: null, problems: {}, done: 0 };

export type ReplaceSlot = { id: string; label: string; holders: HolderStretch[] };
export type ReplaceMember = { id: string; name: string };

type Props = {
  committeeId: string;
  amount: number;
  periods: number;
  display: { style: DisplayStyle; grouping: DisplayGrouping };
  slots: ReplaceSlot[];
  members: ReplaceMember[];
};

/**
 * A member leaves and someone else takes over one slot from a later period. The leaver's earlier payments stay
 * theirs, and the pot of that slot is split by the periods each person was responsible for (rules L1 to L3).
 */
export function ReplacePanel({ committeeId, amount, periods, display, slots, members }: Props) {
  const [state, action, pending] = useActionState(replaceHolder, initial);
  const [slotId, setSlotId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [from, setFrom] = useState("");

  const slot = slots.find((s) => s.id === slotId);
  const current = slot?.holders[slot.holders.length - 1];
  const candidates = members.filter((m) => m.id !== current?.memberId);
  const replacement = candidates.find((m) => m.id === memberId);
  const firstPeriod = current ? current.fromPeriod + 1 : 2;
  const periodChoices = Array.from({ length: Math.max(0, periods - firstPeriod + 1) }, (_, i) => firstPeriod + i);
  const fromNumber = Number(from);
  const shares =
    slot && replacement && from !== "" && periodChoices.includes(fromNumber)
      ? previewReplacement(slot.holders, { memberId: replacement.id, name: replacement.name }, fromNumber, amount, periods)
      : null;
  const money = (n: number) => formatRupees(n, display);

  return (
    <form action={action} aria-label="A member leaves" className="card-form">
      <input type="hidden" name="committeeId" value={committeeId} />
      <h3>A member leaves</h3>
      <p className="mut" style={{ marginBottom: 12 }}>
        Someone else takes over one slot from a later period. What the leaver already paid stays with the leaver. Add the replacement as a member first.
      </p>
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="rep-slot">Slot that changes hands</label>
        <select
          className="input"
          id="rep-slot"
          name="slotId"
          value={slotId}
          required
          onChange={(e) => {
            setSlotId(e.target.value);
            setMemberId("");
            setFrom("");
          }}
        >
          <option value="">Choose a slot</option>
          {slots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rep-member">Replacement</label>
        <select className="input" id="rep-member" name="memberId" value={memberId} required disabled={!slot} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">{slot ? "Choose a member" : "Choose a slot first"}</option>
          {candidates.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="rep-from">Takes over from period</label>
        <select className="input" id="rep-from" name="fromPeriod" value={from} required disabled={!slot} onChange={(e) => setFrom(e.target.value)}>
          <option value="">{slot ? "Choose a period" : "Choose a slot first"}</option>
          {periodChoices.map((p) => (
            <option key={p} value={p}>
              Period {p}
            </option>
          ))}
        </select>
        <span className="hint">{current ? `${current.name} stays responsible up to the period before.` : "Periods are counted from the start date."}</span>
      </div>

      {shares ? (
        <div className="note ok" role="status" style={{ marginBottom: 16 }}>
          <Icon name="check" />
          <div>
            <b>When this slot&rsquo;s pot is paid out, it is split by the periods each person was responsible for:</b>
            <ul className="problems">
              {shares.map((s, i) => (
                <li key={i} dir="auto">
                  {s.name}: {money(s.amount)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="rep-reason">Reason (optional)</label>
        <input className="input" id="rep-reason" name="reason" maxLength={200} autoComplete="off" dir="auto" placeholder="For example: moved abroad" />
        <span className="hint">It is written to the history with the names and the first period.</span>
      </div>

      <button className="btn primary" disabled={pending || !shares}>
        {pending ? "Saving…" : "Hand the slot over"}
      </button>
    </form>
  );
}
