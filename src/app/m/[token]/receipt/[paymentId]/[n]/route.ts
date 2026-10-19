import { NextResponse } from "next/server";
import { isUuid } from "@/lib/dal";
import { receiptResponse } from "@/lib/member-receipt";
import { looksLikeToken } from "@/lib/member-view";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** A member opens one of their own receipts through their private link. Anything that is not theirs gives the same not-found. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string; paymentId: string; n: string }> }) {
  const { token, paymentId, n } = await params;
  const which = Number(n);
  if (!looksLikeToken(token) || !isUuid(paymentId) || !Number.isInteger(which) || which < 1 || which > 2) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("member_receipt_paths", { p_token: token, p_payment_id: paymentId });
  if (error) return NextResponse.json({ error: "We couldn't open the receipt. Try again." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  return receiptResponse(data as string[], which);
}
