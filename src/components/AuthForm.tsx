"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/(auth)/actions";
import { Icon } from "./Icon";
import { ErrorNote } from "./states";

const initialState: AuthState = { error: null, fields: {}, notice: null };

/** The sign-in and sign-up form: one component, two modes, so the two pages cannot drift apart. */
export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string | null }) {
  const up = mode === "sign-up";
  const [state, action, pending] = useActionState(up ? signUp : signIn, initialState);

  return (
    <form action={action} noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <div style={{ marginBottom: 16 }}>
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      ) : null}
      {state.notice ? (
        <div className="note ok" role="status" style={{ marginBottom: 16 }}>
          <Icon name="check" />
          <span>{state.notice}</span>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          className="input"
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={state.fields.email ? true : undefined}
          aria-describedby={state.fields.email ? "email-error" : undefined}
        />
        {state.fields.email ? (
          <span className="hint bad" id="email-error">
            {state.fields.email}
          </span>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          className="input"
          id="password"
          name="password"
          type="password"
          autoComplete={up ? "new-password" : "current-password"}
          aria-invalid={state.fields.password ? true : undefined}
          aria-describedby={state.fields.password ? "password-error" : up ? "password-hint" : undefined}
        />
        {state.fields.password ? (
          <span className="hint bad" id="password-error">
            {state.fields.password}
          </span>
        ) : up ? (
          <span className="hint" id="password-hint">
            At least 8 characters.
          </span>
        ) : null}
      </div>

      <button className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={pending}>
        {pending ? (up ? "Creating account…" : "Signing in…") : up ? "Create account" : "Sign in"}
      </button>

      <p className="sm mut" style={{ marginTop: 16 }}>
        {up ? (
          <>
            Already have an account? <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"}>Sign in</Link>. Have a link from your organiser? Open it: no account needed.
          </>
        ) : (
          <>
            New here? <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"}>Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
