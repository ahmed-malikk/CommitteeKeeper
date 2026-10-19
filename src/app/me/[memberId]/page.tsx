import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MemberBody } from "@/components/MemberBody";
import { PageTransition } from "@/components/PageTransition";
import { PublicShell } from "@/components/PublicShell";
import { isUuid, requireUser } from "@/lib/dal";
import { parseMemberView } from "@/lib/member-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your committee", robots: { index: false } };

/** One of my committees, as a member with an account: the same page as the private link, found by the account instead of by the link. */
export default async function MyMembership({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  await requireUser();
  if (!isUuid(memberId)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_home");
  const view = error ? null : (Array.isArray(data) ? data : []).map(parseMemberView).find((v) => v?.me.member_id === memberId);
  if (!view) notFound();

  return (
    <PublicShell>
      <PageTransition>
        <p style={{ marginTop: 16 }}>
          <Link className="btn ghost small" href="/me">
            <Icon name="back" />
            All my committees
          </Link>
        </p>
        <MemberBody view={view} receiptHref={(paymentId, n) => `/me/${memberId}/receipt/${paymentId}/${n}`} />
      </PageTransition>
    </PublicShell>
  );
}
