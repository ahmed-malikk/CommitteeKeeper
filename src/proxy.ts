import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, SIGN_IN_PATH, isAuthPage, needsSignIn } from "@/lib/access";

/**
 * Runs before every page. Two jobs:
 *   1. Keeps the sign-in session fresh (Supabase sessions expire; refreshed cookies are copied to the response).
 *   2. A quick first check: signed-out visitors can't even start loading an organiser's page, and signed-in
 *      organisers are taken past the sign-in and sign-up pages.
 * Each page checks again (src/lib/dal.ts), and the database's row-level security is the final guard.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Checks the session token and refreshes it if needed. Keep this call directly after creating the client.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const path = request.nextUrl.pathname;

  const redirectTo = !signedIn && needsSignIn(path) ? SIGN_IN_PATH : signedIn && isAuthPage(path) ? HOME_PATH : null;
  if (redirectTo) {
    const redirect = NextResponse.redirect(new URL(redirectTo, request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  // Every page except Next.js internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
