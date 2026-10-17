// Checks what someone typed into the sign-in and sign-up forms before it is sent anywhere.
// The server checks again (never trust the browser), and Supabase has the final say.
export type CredentialProblems = { email?: string; password?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72; // the password hashing used by Supabase ignores everything after 72 bytes

export function validateCredentials(mode: "sign-in" | "sign-up", email: string, password: string): CredentialProblems {
  const problems: CredentialProblems = {};
  const trimmed = email.trim();

  if (trimmed === "") problems.email = "Enter your email address.";
  else if (!EMAIL.test(trimmed)) problems.email = "That doesn't look like an email address. Check it for typos.";

  if (password === "") problems.password = "Enter your password.";
  else if (mode === "sign-up" && password.length < MIN_PASSWORD) {
    problems.password = `Use at least ${MIN_PASSWORD} characters.`;
  } else if (new TextEncoder().encode(password).length > MAX_PASSWORD) {
    problems.password = `Use at most ${MAX_PASSWORD} characters.`;
  }
  return problems;
}
