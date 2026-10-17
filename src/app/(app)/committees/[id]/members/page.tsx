import { notFound } from "next/navigation";
import { CommitteeHeader } from "@/components/CommitteeHeader";
import { Icon } from "@/components/Icon";
import { AddMemberForm, MemberRow } from "@/components/MemberForms";
import { PageTransition } from "@/components/PageTransition";
import { ErrorNote } from "@/components/states";
import { getCommittee } from "@/lib/dal";
import { duesFor, potOf } from "@/lib/ledger";
import { formatRupees } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  return { title: c ? `Members · ${c.name}` : "Members" };
}

export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCommittee(id);
  if (!c) notFound();

  const supabase = await createClient();
  const [members, slots, holders] = await Promise.all([
    supabase.from("members").select("id, name, email, phone").eq("committee_id", id).order("created_at"),
    supabase.from("slots").select("id").eq("committee_id", id),
    supabase.from("slot_holders").select("slot_id, member_id, slots!inner(committee_id)").eq("slots.committee_id", id),
  ]);
  const failed = members.error || slots.error || holders.error;

  const slotCount = slots.data?.length ?? 0;
  const perMember = new Map<string, number>();
  for (const h of holders.data ?? []) perMember.set(h.member_id, (perMember.get(h.member_id) ?? 0) + 1);

  const format = { style: c.display_style, grouping: c.display_grouping } as const;
  const money = (n: number) => formatRupees(n, format);
  const forming = c.status === "forming";
  const room = c.periods - slotCount;
  const complete = slotCount === c.periods;

  return (
    <PageTransition>
      <CommitteeHeader committee={c} active="members" />

      {failed ? (
        <ErrorNote>We couldn&rsquo;t load the members. Check the connection and refresh the page.</ErrorNote>
      ) : (
        <div className="two rise" style={{ ["--i" as string]: 2 }}>
          <section>
            <h2>Members and slots</h2>
            {forming ? (
              <div className={`note ${complete ? "ok" : "warn"}`} role="status" style={{ marginBottom: 14 }}>
                <Icon name={complete ? "check" : "alert"} />
                <span>
                  {complete
                    ? `${slotCount} slots for ${c.periods} periods. The pot is ${money(potOf(c.amount, slotCount))} each period.`
                    : `${slotCount} of ${c.periods} slots given out. ${room} more ${room === 1 ? "slot is" : "slots are"} needed before the committee can start. Pot so far: ${money(potOf(c.amount, slotCount))}.`}
                </span>
              </div>
            ) : (
              <p className="note" style={{ marginBottom: 14 }}>
                <span>
                  {slotCount} slots. The pot is {money(potOf(c.amount, slotCount))} each period.
                </span>
              </p>
            )}

            {members.data && members.data.length > 0 ? (
              <ul className="list members">
                {members.data.map((m) => {
                  const held = perMember.get(m.id) ?? 0;
                  return (
                    <MemberRow
                      key={m.id}
                      committeeId={id}
                      member={m}
                      slots={held}
                      duesText={`owes ${money(duesFor(c.amount, held))} each period`}
                      canChangeSlots={forming}
                      canRemove={forming}
                      roomLeft={room > 0}
                    />
                  );
                })}
              </ul>
            ) : (
              <p className="mut">No members yet. Add the first one with the form.</p>
            )}
          </section>

          <section>
            <h2>{members.data && members.data.length > 0 ? "Add another member" : "Add the first member"}</h2>
            <AddMemberForm committeeId={id} withSlots={forming} room={room} />
            <p className="sm mut" style={{ marginTop: 10 }}>
              Email and phone are visible to you only. Members never see each other&rsquo;s details.
            </p>
          </section>
        </div>
      )}
    </PageTransition>
  );
}
