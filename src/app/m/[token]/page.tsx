import Link from "next/link";
import { notFound } from "next/navigation";
import { AttachAccount } from "@/components/AttachAccount";
import { MemberBody } from "@/components/MemberBody";
import { PageTransition } from "@/components/PageTransition";
import { PublicShell } from "@/components/PublicShell";
import { getCurrentUser } from "@/lib/dal";
import { looksLikeToken, parseMemberView } from "@/lib/member-view";
import { createClient } from "@/lib/supabase/server";

// A link carries a secret, so the page is never cached, never indexed, and never passes its address on to other sites.
export const dynamic = "force-dynamic";
export const metadata = { title: "Your committee", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function MemberPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!looksLikeToken(token)) notFound();

  // member_view is the only door: it returns this member's own information, or an empty answer for any link that does not work.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_view", { p_token: token });
  // A database that can't be reached is not a link that doesn't work: say so, instead of telling the member their link is dead.
  if (error) {
    return (
      <PublicShell>
        <div className="prose" style={{ paddingTop: 24 }}>
          <h1>We couldn&rsquo;t load this page</h1>
          <p className="mut">Check your connection and refresh. Your link is fine.</p>
        </div>
      </PublicShell>
    );
  }
  const view = parseMemberView(data);
  if (!view) notFound();

  // Is this link already part of the signed-in account? (member_home lists only that account's own memberships.)
  const user = await getCurrentUser();
  let attached = false;
  if (user) {
    const home = await supabase.rpc("member_home");
    attached = (Array.isArray(home.data) ? home.data : []).some((h) => parseMemberView(h)?.me.member_id === view.me.member_id);
  }
  const next = encodeURIComponent(`/m/${token}`);

  return (
    <PublicShell>
      <PageTransition>
        <MemberBody view={view} receiptHref={(paymentId, n) => `/m/${token}/receipt/${paymentId}/${n}`} />
        <section className="mview mblock maccount" aria-labelledby="macc-h">
          <h2 id="macc-h">Keep all your committees together</h2>
          <p className="mut">
            You don&rsquo;t need an account: this link is enough. If you belong to more than one committee, an account shows them all in one place. It is view only and optional.
          </p>
          {!user ? (
            <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn secondary" href={`/sign-in?next=${next}`}>
                Sign in
              </Link>
              <Link className="btn ghost" href={`/sign-up?next=${next}`}>
                Create an account
              </Link>
            </p>
          ) : attached ? (
            <p>
              This link is in your account. <Link href="/me">See all your committees</Link>.
            </p>
          ) : (
            <AttachAccount token={token} />
          )}
        </section>
      </PageTransition>
    </PublicShell>
  );
}
