import { notFound } from "next/navigation";
import { PageTransition } from "@/components/PageTransition";
import { PublicShell } from "@/components/PublicShell";
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
  const view = error ? null : parseMemberView(data);
  if (!view) notFound();

  return (
    <PublicShell>
      <PageTransition>
        <div className="prose" style={{ paddingTop: 24 }}>
          <h1 dir="auto">{view.committee.name}</h1>
          <p className="mut" dir="auto">
            Hello {view.me.name}.
          </p>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
