"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/** For a member with no phone number saved: copies the message so it can be pasted into any chat. */
export function CopyMessage({ text, who }: { text: string; who: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn secondary small"
      type="button"
      aria-label={`Copy message for ${who}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          // Some browsers refuse; the message is on screen to copy by hand.
        }
      }}
    >
      <Icon name={copied ? "check" : "list"} />
      {copied ? "Copied" : "Copy message"}
    </button>
  );
}
