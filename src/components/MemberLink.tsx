"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { newMemberLink, setMemberLink } from "@/app/(app)/committees/[id]/members/actions";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";
import { useConfirmFocus } from "./useConfirmFocus";

type Props = { committeeId: string; memberId: string; name: string; token: string; enabled: boolean };

/**
 * A member's private link: copy it to send, turn it off, or replace it. Turning it off or replacing it stops the old
 * link at once. Anyone who opens a stopped link sees exactly what they would see for a link that never existed.
 */
export function MemberLink({ committeeId, memberId, name, token, enabled }: Props) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { box, trigger } = useConfirmFocus(asking);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const url = `${origin}/m/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      field.current?.select();
    }
  }
  const run = (job: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null);
      const result = await job();
      setError(result.error);
      setAsking(false);
    });

  return (
    <div className="mlink" role="group" aria-label={`Private link for ${name}`}>
      <div className="mlinkrow">
        <span className={`chip ${enabled ? "paid" : ""}`}>
          <Icon name={enabled ? "check" : "lock"} />
          {enabled ? "Link on" : "Link off"}
        </span>
        {enabled ? (
          <>
            <input ref={field} className="input mlinkurl" readOnly value={url} aria-label={`Link for ${name}`} onFocus={(e) => e.currentTarget.select()} />
            <button className="btn secondary small" type="button" onClick={copy} aria-label={`Copy the link for ${name}`}>
              <Icon name={copied ? "check" : "list"} />
              {copied ? "Copied" : "Copy link"}
            </button>
          </>
        ) : (
          <span className="s">Anyone who opens it sees nothing.</span>
        )}
        <button className="btn ghost small" type="button" disabled={pending} onClick={() => run(() => setMemberLink(committeeId, memberId, !enabled))} aria-label={`${enabled ? "Turn off" : "Turn on"} the link for ${name}`}>
          {enabled ? "Turn off" : "Turn on"}
        </button>
        {!asking ? (
          <button className="btn ghost small" type="button" ref={trigger} disabled={pending} onClick={() => setAsking(true)} aria-label={`Make a new link for ${name}`}>
            New link
          </button>
        ) : null}
      </div>
      {asking ? (
        <div className="note" role="group" aria-label={`Confirm a new link for ${name}`} ref={box} tabIndex={-1} style={{ marginTop: 8 }}>
          <Icon name="alert" />
          <div>
            <b>Make a new link for {name}?</b> The old link stops working at once, and you will need to send them the new one.
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn primary small" type="button" disabled={pending} onClick={() => run(() => newMemberLink(committeeId, memberId))}>
                {pending ? "Working…" : "Yes, make a new link"}
              </button>
              <button className="btn secondary small" type="button" disabled={pending} onClick={() => setAsking(false)}>
                Not yet
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {error ? (
        <div style={{ marginTop: 8 }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}
    </div>
  );
}
