import { NextResponse } from "next/server";
import { getCurrentUser, isUuid } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

/** How long a download link works: long enough to open the image, too short to pass around. */
const LINK_SECONDS = 60;

/**
 * Opens a receipt: checks it is one of the signed-in organiser's (row-level security hides anyone else's, so it looks
 * like it does not exist), then sends the browser to a link that stops working after a minute. The bucket itself is private.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; receiptId: string }> }) {
  const headers = { "Cache-Control": "no-store" };
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in to open this receipt." }, { status: 401, headers });
  const { id, receiptId } = await params;
  if (!isUuid(id) || !isUuid(receiptId)) return NextResponse.json({ error: "Not found." }, { status: 404, headers });

  const supabase = await createClient();
  const receipt = await supabase.from("receipts").select("storage_path").eq("id", receiptId).eq("committee_id", id).is("removed_at", null).maybeSingle();
  if (receipt.error || !receipt.data) return NextResponse.json({ error: "Not found." }, { status: 404, headers });

  const link = await supabase.storage.from("receipts").createSignedUrl(receipt.data.storage_path, LINK_SECONDS);
  if (link.error || !link.data) return NextResponse.json({ error: "We couldn't open the receipt. Try again." }, { status: 502, headers });
  return NextResponse.redirect(link.data.signedUrl, { status: 302, headers });
}
