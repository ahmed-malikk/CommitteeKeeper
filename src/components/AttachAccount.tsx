"use client";

import { useActionState } from "react";
import { attachAccount, type AttachState } from "@/app/m/[token]/attach-action";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initial: AttachState = { error: null };

/** One button: add this link to the account that is signed in. */
export function AttachAccount({ token }: { token: string }) {
  const [state, action, pending] = useActionState(attachAccount, initial);
  return (
    <form action={action} aria-label="Add this link to my account">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      <button className="btn primary" disabled={pending}>
        <Icon name="plus" />
        {pending ? "Adding…" : "Add this link to my account"}
      </button>
    </form>
  );
}
