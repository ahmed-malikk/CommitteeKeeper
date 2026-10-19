"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { HOME_PATH, safeNext } from "@/lib/access";
import { validateCredentials, type CredentialProblems } from "@/lib/credentials";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error: string | null; fields: CredentialProblems; notice: string | null };

/**
 * What to tell the person when sign-in fails. A wrong email and a wrong password get the same message,
 * so the form doesn't reveal which emails have accounts. Other failures say what to do next.
 */
function signInError(error: AuthError): string {
  if (error.code === "invalid_credentials") return "Wrong email or password. Nothing was changed.";
  if (error.code === "email_not_confirmed") return "Confirm your email first: we sent you a link when you signed up.";
  if (error.code === "over_request_rate_limit" || error.status === 429) return "Too many attempts. Wait a minute, then try again.";
  console.error("Sign-in failed:", error.status, error.code, error.message);
  if (!error.status || error.status >= 500) return "Couldn't reach the sign-in service. Check the connection and try again.";
  return "Wrong email or password. Nothing was changed.";
}

function signUpError(error: AuthError): string {
  if (error.code === "weak_password") return "That password is too easy to guess. Try a longer one.";
  if (error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || error.status === 429) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  console.error("Sign-up failed:", error.status, error.code, error.message);
  if (!error.status || error.status >= 500) return "Couldn't reach the sign-up service. Check the connection and try again.";
  return "We couldn't create that account. Check the details and try again.";
}

const read = (formData: FormData) => ({
  email: String(formData.get("email") ?? "").trim(),
  password: String(formData.get("password") ?? ""),
});

/** Runs on the server when the sign-in form is submitted. */
export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = read(formData);
  const fields = validateCredentials("sign-in", email, password);
  if (Object.keys(fields).length > 0) return { error: null, fields, notice: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: signInError(error), fields: {}, notice: null };
  redirect(safeNext(formData.get("next")) ?? HOME_PATH);
}

/** Runs on the server when the sign-up form is submitted. */
export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = read(formData);
  const fields = validateCredentials("sign-up", email, password);
  if (Object.keys(fields).length > 0) return { error: null, fields, notice: null };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: signUpError(error), fields: {}, notice: null };
  // With email confirmation on, there is no session yet: the person must open the link we emailed.
  if (!data.session) {
    return { error: null, fields: {}, notice: "Check your email: we sent a link to confirm your account. Then sign in." };
  }
  redirect(safeNext(formData.get("next")) ?? HOME_PATH);
}

export async function signOut() {
  const supabase = await createClient();
  // Only this browser: the default ("global") would sign the account out on every device.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
