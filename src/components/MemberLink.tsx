"use client";

import { QRCodeSVG } from "qrcode.react";
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
  const [manual, setManual] = useState(false);
  const settings = useRef<HTMLDetailsElement>(null);
  const qr = useRef<HTMLDialogElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const qrButton = useRef<HTMLButtonElement>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  // The QR code is only drawn while its dialog is open, so a page of many members is not full of hidden codes.
  useEffect(() => {
    if (qrOpen) qr.current?.showModal();
  }, [qrOpen]);
  const url = `${origin}/m/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // The browser refused the clipboard: show the address so it can be copied by hand.
      setManual(true);
    }
  }
  const run = (job: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setError(null);
      const result = await job();
      setError(result.error);
      setAsking(false);
      if (!result.error) settings.current?.removeAttribute("open");
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
            <button className="btn secondary small" type="button" onClick={copy} aria-label={`Copy link for ${name}`}>
              <Icon name={copied ? "check" : "list"} />
              {copied ? "Copied" : "Copy link"}
            </button>
            <button className="btn secondary small" type="button" ref={qrButton} onClick={() => setQrOpen(true)} aria-label={`Show QR code for ${name}`}>
              <Icon name="qr" />
              QR code
            </button>
            <details className="linkmore" ref={settings}>
              <summary className="btn ghost small">Link settings</summary>
              <div className="linkmorebody">
                <button className="btn ghost small" type="button" disabled={pending} onClick={() => run(() => setMemberLink(committeeId, memberId, false))} aria-label={`Turn off the link for ${name}`}>
                  Turn off
                </button>
                {!asking ? (
                  <button className="btn ghost small" type="button" ref={trigger} disabled={pending} onClick={() => setAsking(true)} aria-label={`Make a new link for ${name}`}>
                    New link
                  </button>
                ) : null}
              </div>
            </details>
          </>
        ) : (
          <>
            <span className="s">Anyone who opens it sees nothing.</span>
            <button className="btn ghost small" type="button" disabled={pending} onClick={() => run(() => setMemberLink(committeeId, memberId, true))} aria-label={`Turn on the link for ${name}`}>
              Turn on
            </button>
          </>
        )}
      </div>
      {manual ? (
        <p className="s mlinkmanual" role="status">
          Your browser would not copy it. Select this address and copy it yourself: <span className="fp">{url}</span>
        </p>
      ) : null}
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
      {enabled && origin !== "" ? (
        <dialog
          ref={qr}
          className="qrdialog"
          aria-label={`QR code for ${name}`}
          onClose={() => {
            setQrOpen(false);
            qrButton.current?.focus();
          }}
        >
          {qrOpen ? (
            <>
              <h3 dir="auto">{name}</h3>
              <div role="img" aria-label={`QR code for ${name}'s link`} data-link={url} className="qrbox">
                <QRCodeSVG value={url} size={208} marginSize={2} level="M" aria-hidden="true" />
              </div>
              <p className="mut">Ask {name} to point their phone camera at this. It opens their own page, and nobody else&rsquo;s.</p>
              <div className="qractions">
                <button className="btn secondary" type="button" onClick={copy}>
                  <Icon name={copied ? "check" : "list"} />
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button className="btn primary" type="button" onClick={() => qr.current?.close()}>
                  Done
                </button>
              </div>
            </>
          ) : null}
        </dialog>
      ) : null}
    </div>
  );
}
