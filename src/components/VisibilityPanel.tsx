"use client";

import { useState, useTransition } from "react";
import { setVisibility } from "@/app/(app)/committees/[id]/visibility-action";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

type Flags = { payments: boolean; turns: boolean; history: boolean };

const SWITCHES: { key: keyof Flags; title: string; help: string }[] = [
  { key: "payments", title: "Who has paid", help: "Other members' payment status this month." },
  { key: "turns", title: "Whose turn it is", help: "The full order of turns." },
  { key: "history", title: "The history entries about them", help: "What the record says about the member themselves, never about anyone else." },
];

/**
 * The organiser's three privacy switches, all off by default. Each switch saves the moment it is flipped and applies to
 * every member screen at once. A member always sees their own turn, months left and status whatever is chosen here.
 */
export function VisibilityPanel({ committeeId, initial, readOnly }: { committeeId: string; initial: Flags; readOnly: boolean }) {
  const [flags, setFlags] = useState<Flags>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function flip(key: keyof Flags, value: boolean) {
    const next = { ...flags, [key]: value };
    setFlags(next);
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await setVisibility(committeeId, next.payments, next.turns, next.history);
      if (result.error) {
        setFlags(flags); // the save failed: show what is really stored
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <section aria-labelledby="vis-h">
      <h2 id="vis-h">What members can see</h2>
      <div className="list" style={{ padding: "0 18px" }} role="group" aria-label="What members can see">
        {SWITCHES.map(({ key, title, help }) => (
          <label className="sw" key={key}>
            <div>
              <div className="t">{title}</div>
              <div className="s">{help}</div>
            </div>
            <input type="checkbox" checked={flags[key]} disabled={readOnly || pending} onChange={(e) => flip(key, e.target.checked)} aria-label={title} />
          </label>
        ))}
      </div>
      <p className="sm mut" style={{ marginTop: 8 }} role="status">
        {error ? null : saved ? (
          <>
            <Icon name="check" /> Saved. Every member screen shows this now.
          </>
        ) : readOnly ? (
          "This committee is completed, so this can no longer change."
        ) : (
          "A member always sees their own turn, months left, status, payments and receipts, and nothing about anyone else."
        )}
      </p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </section>
  );
}
