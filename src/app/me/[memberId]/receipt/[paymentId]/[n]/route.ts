import { NextResponse } from "next/server";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { receiptResponse } from "@/lib/member-receipt";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** A member with an account opens one of their own receipts. Anything that is not theirs gives the same not-found. */
export async function GET(_request: Request, { params }: { params: Promise<{ memberId: string; paymentId: string; n: string }> }) {
  const { memberId, paymentId, n } = await params;
  const which = Number(n);
  const none = NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in to open this receipt." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(memberId) || !isUuid(paymentId) || !Number.isInteger(which) || which < 1 || which > 2) return none;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_receipt_paths_account", { p_member_id: memberId, p_payment_id: paymentId });
  if (error) return NextResponse.json({ error: "We couldn't open the receipt. Try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return receiptResponse(data as string[], which);
}
