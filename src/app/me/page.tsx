import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { Icon } from "@/components/Icon";
import { PageTransition } from "@/components/PageTransition";
import { PublicShell } from "@/components/PublicShell";
import { EmptyState, ErrorNote } from "@/components/states";
import { requireUser } from "@/lib/dal";
import { parseMemberView, progressText, turnText, type MemberView } from "@/lib/member-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My committees as a member", robots: { index: false } };

const STATUS_CLASS = { forming: "form", running: "run", completed: "done" } as const;
const STATUS_TEXT = { forming: "Forming", running: "Running", completed: "Completed" } as const;

/** Every committee this account belongs to as a member, together. View only: the account has no access to any table, only to what the database returns for it. */
export default async function MyMemberships() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_home");
  const views: MemberView[] | null = error ? null : (Array.isArray(data) ? data : []).map(parseMemberView).filter((v): v is MemberView => v !== null);

  return (
    <PublicShell>
      <PageTransition>
        <div className="mview">
          <h1>My committees as a member</h1>
          <p className="mut">Signed in as {user.email}. This page only shows; it can&rsquo;t change anything.</p>
          {views === null ? (
            <ErrorNote>We couldn&rsquo;t load your committees. Check the connection and refresh the page.</ErrorNote>
          ) : views.length === 0 ? (
            <EmptyState title="No committees here yet">Open the link your organiser sent you, then choose &ldquo;Add this link to my account&rdquo;.</EmptyState>
          ) : (
            <ul className="list" style={{ marginTop: 18 }}>
              {views.map((v) => (
                <li key={v.me.member_id}>
                  <Link className="li" href={`/me/${v.me.member_id}`}>
                    <span className="grow">
                      <span className="t" dir="auto">
                        {v.committee.name}
                      </span>
                      <span className="s" dir="auto">
                        {v.me.name} &middot; {progressText(v)}
                      </span>
                      {v.my_slots[0] ? <span className="s">{turnText(v.my_slots[0], v.committee.start_date)}</span> : null}
                    </span>
                    <span className={`chip ${STATUS_CLASS[v.committee.status]}`}>{STATUS_TEXT[v.committee.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <form action={signOut} style={{ marginTop: 24 }}>
            <button className="btn secondary" type="submit">
              <Icon name="out" />
              Sign out of this device
            </button>
          </form>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
