// Which pages need a signed-in organiser. The proxy uses this for a first, fast check;
// the pages ask again (src/lib/dal.ts) and the database's row-level security is the final guard.
export const SIGN_IN_PATH = "/sign-in";
export const HOME_PATH = "/committees";

const NEEDS_SIGN_IN = ["/committees", "/me"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** True for every page that shows an organiser's own data. */
export function needsSignIn(pathname: string): boolean {
  return NEEDS_SIGN_IN.some((base) => under(pathname, base));
}

/** The sign-in and sign-up pages: someone who is already signed in has no reason to see them. */
export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.some((base) => under(pathname, base));
}

/**
 * Where to go after signing in or up when the person came from a member link ("keep this link in my account").
 * Only the member pages are allowed: a link to a member page or to /me, nothing else, so a crafted address
 * can never send someone to another site or to an unexpected page.
 */
export function safeNext(value: unknown): string | null {
  return typeof value === "string" && /^\/(m\/[A-Za-z0-9_-]{20,64}|me(\/[0-9a-f-]{36})?)$/.test(value) ? value : null;
}
