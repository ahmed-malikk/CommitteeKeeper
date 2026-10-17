"use client";

import { useActionState, useEffect, useRef } from "react";
import { addMember, addSlot, editMember, removeMember, removeSlot, type MemberState } from "@/app/(app)/committees/[id]/members/actions";
import { EMAIL_MAX, MEMBER_NAME_MAX, PHONE_MAX, type MemberProblems } from "@/lib/member";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: MemberState = { error: null, problems: {}, done: 0 };

function Problem({ id, text }: { id: string; text?: string }) {
  return text ? (
    <span className="hint bad" id={id}>
      {text}
    </span>
  ) : null;
}

/** The name, email and phone fields, shared by "add" and "edit" so the two cannot drift apart. */
function MemberFields({ prefix, problems, defaults }: { prefix: string; problems: MemberProblems; defaults?: { name: string; email: string; phone: string } }) {
  const bad = (f: keyof MemberProblems) => ({ "aria-invalid": problems[f] ? (true as const) : undefined, "aria-describedby": problems[f] ? `${prefix}-${f}-error` : undefined });
  return (
    <>
      <div className="field">
        <label htmlFor={`${prefix}-name`}>Name</label>
        <input className="input" id={`${prefix}-name`} name="name" dir="auto" autoComplete="off" maxLength={MEMBER_NAME_MAX * 2} defaultValue={defaults?.name} {...bad("name")} />
        <Problem id={`${prefix}-name-error`} text={problems.name} />
      </div>
      <div className="pair">
        <div className="field">
          <label htmlFor={`${prefix}-email`}>Email (optional)</label>
          <input className="input" id={`${prefix}-email`} name="email" type="email" autoComplete="off" maxLength={EMAIL_MAX} defaultValue={defaults?.email} {...bad("email")} />
          <Problem id={`${prefix}-email-error`} text={problems.email} />
        </div>
        <div className="field">
          <label htmlFor={`${prefix}-phone`}>Phone (optional)</label>
          <input className="input" id={`${prefix}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="off" maxLength={PHONE_MAX} defaultValue={defaults?.phone} {...bad("phone")} />
          <Problem id={`${prefix}-phone-error`} text={problems.phone} />
        </div>
      </div>
    </>
  );
}

/** Add a member, with how many slots they hold (while the committee is still forming). */
export function AddMemberForm({ committeeId, withSlots, room }: { committeeId: string; withSlots: boolean; room: number }) {
  const [state, action, pending] = useActionState(addMember, initial);
  const form = useRef<HTMLFormElement>(null);
  // Clear the form after a member was added, so the next one starts empty.
  useEffect(() => {
    if (state.done > 0) form.current?.reset();
  }, [state.done]);

  return (
    <form action={action} ref={form} noValidate className="card-form" aria-label="Add a member">
      <input type="hidden" name="committeeId" value={committeeId} />
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <MemberFields prefix="add" problems={state.problems} />
      {withSlots ? (
        <div className="field" style={{ maxWidth: 220 }}>
          <label htmlFor="add-slots">Slots</label>
          <input className="input" id="add-slots" name="slots" inputMode="numeric" autoComplete="off" defaultValue="1" aria-invalid={state.problems.slots ? true : undefined} aria-describedby="add-slots-help" />
          {state.problems.slots ? (
            <Problem id="add-slots-help" text={state.problems.slots} />
          ) : (
            <span className="hint" id="add-slots-help">
              Each slot is its own turn and its own instalment. {room} left.
            </span>
          )}
        </div>
      ) : null}
      <button className="btn primary" disabled={pending}>
        <Icon name="plus" />
        {pending ? "Adding…" : "Add member"}
      </button>
    </form>
  );
}

type RowProps = {
  committeeId: string;
  member: { id: string; name: string; email: string | null; phone: string | null };
  slots: number;
  /** Stretches of a slot this member covered that someone else has taken over since. */
  earlier: number;
  duesText: string;
  canChangeSlots: boolean;
  canRemove: boolean;
  roomLeft: boolean;
  /** A completed committee: the member can be read but not edited. */
  readOnly?: boolean;
};

/** One member: their slots, contact details (organiser only), and the things the organiser can do. */
export function MemberRow({ committeeId, member, slots, earlier, duesText, canChangeSlots, canRemove, roomLeft, readOnly }: RowProps) {
  const [editState, edit, editing] = useActionState(editMember, initial);
  const [slotState, plus, plusPending] = useActionState(addSlot, initial);
  const [minusState, minus, minusPending] = useActionState(removeSlot, initial);
  const [removeState, remove, removing] = useActionState(removeMember, initial);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (editState.done > 0) details.current?.removeAttribute("open");
  }, [editState.done]);

  const error = slotState.error || minusState.error || removeState.error;
  const hidden = (
    <>
      <input type="hidden" name="committeeId" value={committeeId} />
      <input type="hidden" name="memberId" value={member.id} />
    </>
  );

  return (
    <li className="member">
      <div className="mrow">
        <div className="grow">
          <span className="t" dir="auto">
            {member.name}
          </span>
          <span className="s">
            {slots === 0 ? (earlier > 0 ? "No slot now · covered earlier periods of a slot" : "No slot yet") : `${slots} slot${slots === 1 ? "" : "s"} · ${duesText}${earlier > 0 ? " · covered earlier periods of another slot" : ""}`}
          </span>
          {member.email || member.phone ? (
            <span className="s contact" dir="auto">
              {[member.email, member.phone].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
        {canChangeSlots ? (
          <div className="stepper" role="group" aria-label={`Slots for ${member.name}`}>
            <form action={minus}>
              {hidden}
              <button className="btn secondary small" disabled={minusPending || slots === 0} aria-label={`Fewer slots for ${member.name}`}>
                −
              </button>
            </form>
            <span className="n" aria-hidden="true">
              {slots}
            </span>
            <form action={plus}>
              {hidden}
              <button className="btn secondary small" disabled={plusPending || !roomLeft} aria-label={`More slots for ${member.name}`}>
                +
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {error ? (
        <div style={{ margin: "8px 0" }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      {readOnly ? null : (
      <details className="edit" ref={details}>
        <summary className="btn ghost small">Edit details</summary>
        <form action={edit} noValidate aria-label={`Edit ${member.name}`}>
          {hidden}
          {editState.error ? (
            <div style={{ marginBottom: 12 }}>
              <ErrorNote>{editState.error}</ErrorNote>
            </div>
          ) : null}
          <MemberFields prefix={`edit-${member.id}`} problems={editState.problems} defaults={{ name: member.name, email: member.email ?? "", phone: member.phone ?? "" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn primary small" disabled={editing}>
              {editing ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
        {canRemove ? (
          <form action={remove} style={{ marginTop: 10 }}>
            {hidden}
            <button className="btn ghost small danger" disabled={removing || slots > 0} aria-describedby={slots > 0 ? `why-${member.id}` : undefined}>
              Remove member
            </button>
            {slots > 0 ? (
              <span className="hint" id={`why-${member.id}`}>
                Take away their slots first.
              </span>
            ) : null}
          </form>
        ) : null}
      </details>
      )}
    </li>
  );
}
