import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { todayInPakistan } from "@/lib/dates";
import { sendMail, mailConfigured } from "@/lib/mail";
import { periodLabel } from "@/lib/payments";
import { dueList, summaryText, type ReminderKind } from "@/lib/reminders";
import { adminClient } from "@/lib/supabase/admin";
import { holderAt, type HolderStretch } from "@/lib/turns";

// Always run fresh; this is a job, not a page.
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/** Compares two secrets in constant time, so the answer does not leak how many leading characters were right. */
function sameSecret(given: string, wanted: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(wanted);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The daily reminder job (Vercel Cron calls it with `Authorization: Bearer <CRON_SECRET>`).
 * Refused without the secret. With it: for every running committee it works out who is due or late today, and,
 * when email is set up, emails the organiser one summary. Each reminder is logged once per day (the database's
 * unique rule), so running the job twice sends and logs nothing the second time. When email is not set up
 * nothing is sent and nothing is logged, so the first run after it is set up still sends.
 */
export async function GET(request: Request) {
  const wanted = process.env.CRON_SECRET;
  if (!wanted) return NextResponse.json({ error: "The daily job is not set up." }, { status: 503, headers });
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !sameSecret(given, wanted)) return NextResponse.json({ error: "Not allowed." }, { status: 401, headers });

  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "The server key is not set up." }, { status: 503, headers });

  const today = todayInPakistan();
  const committees = await admin.from("committees").select("*").eq("status", "running");
  if (committees.error) return NextResponse.json({ error: "Could not read the committees." }, { status: 502, headers });

  let emailed = 0;
  let logged = 0;
  let waiting = 0;
  for (const c of committees.data ?? []) {
    const [slots, holders, payments, already] = await Promise.all([
      admin.from("slots").select("id").eq("committee_id", c.id),
      admin.from("slot_holders").select("slot_id, member_id, from_period, to_period, members(name), slots!inner(committee_id)").eq("slots.committee_id", c.id),
      admin.from("payments_current").select("slot_id, period, paid_on").eq("committee_id", c.id),
      admin.from("reminder_log").select("member_id, period, kind").eq("committee_id", c.id).eq("channel", "email").eq("sent_on", today),
    ]);
    if (slots.error || holders.error || payments.error || already.error) continue;

    const stretches = new Map<string, HolderStretch[]>();
    for (const h of holders.data ?? []) {
      const member = h.members as unknown as { name: string } | null;
      stretches.set(h.slot_id, [...(stretches.get(h.slot_id) ?? []), { memberId: h.member_id, name: member?.name ?? "A member", fromPeriod: h.from_period, toPeriod: h.to_period }]);
    }
    const terms = { startDate: c.start_date, dueDay: c.due_day, graceDays: c.grace_days, periods: c.periods };
    const items = dueList(
      terms,
      { remindBeforeDays: c.remind_before_days, remindLateEvery: c.remind_late_every },
      today,
      (slots.data ?? []).map((s) => s.id),
      (payments.data ?? []).map((p) => ({ slotId: p.slot_id, period: p.period, paidOn: p.paid_on })),
    ).filter((i) => i.remindToday);

    const done = new Set((already.data ?? []).map((r) => `${r.member_id}|${r.period}|${r.kind}`));
    const fresh = items.flatMap((item) => {
      const holder = holderAt(stretches.get(item.slotId) ?? [], item.period);
      if (!holder || done.has(`${holder.memberId}|${item.period}|${item.kind}`)) return [];
      return [{ item, holder }];
    });
    if (fresh.length === 0) continue; // nothing new today: send nothing, log nothing
    if (!mailConfigured()) {
      waiting += fresh.length;
      continue;
    }

    const organiser = await admin.auth.admin.getUserById(c.organiser_id);
    const to = organiser.data.user?.email;
    if (!to) continue;
    const lines = fresh.map(({ item, holder }) => ({ who: holder.name, month: periodLabel(c.start_date, item.period), kind: item.kind as ReminderKind, daysLate: item.daysLate }));
    const sent = await sendMail(to, `${c.name}: who to remind today`, summaryText(c.name, today, lines));
    if (!sent.sent) continue;
    emailed++;
    const log = await admin.from("reminder_log").insert(fresh.map(({ item, holder }) => ({ committee_id: c.id, member_id: holder.memberId, period: item.period, kind: item.kind, channel: "email", sent_on: today })));
    if (!log.error) logged += fresh.length;
  }

  return NextResponse.json({ ran: true, day: today, committees: committees.data?.length ?? 0, emailed, logged, waitingForEmailSetup: waiting }, { headers });
}
