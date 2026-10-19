import "server-only";
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/** How long a receipt link works: long enough to open the image, too short to pass around. */
const LINK_SECONDS = 60;
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * Sends a member to one of their own receipts. `paths` is what the database function returned for this member and this
 * payment (so it only ever holds that member's own receipts); `n` is which one (1 or 2). A receipt that is not theirs,
 * or does not exist, looks the same as one that never existed. The file itself is in a private bucket, so a short-lived
 * signed link is made with the server-only key; without that key set up, the answer says so rather than guessing.
 */
export async function receiptResponse(paths: string[] | null, n: number) {
  const path = paths?.[n - 1];
  if (!path) return NextResponse.json({ error: "Not found." }, { status: 404, headers });
  const admin = adminClient();
  if (!admin) return NextResponse.json({ error: "Receipts can't be opened right now." }, { status: 503, headers });
  const link = await admin.storage.from("receipts").createSignedUrl(path, LINK_SECONDS);
  if (link.error || !link.data) return NextResponse.json({ error: "We couldn't open the receipt. Try again." }, { status: 502, headers });
  return NextResponse.redirect(link.data.signedUrl, { status: 302, headers });
}
