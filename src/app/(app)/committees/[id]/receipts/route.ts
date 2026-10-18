import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getCommittee, getCurrentUser, isUuid } from "@/lib/dal";
import { explainDbError } from "@/lib/db-errors";
import { RECEIPT_MAX_BYTES, freeSlotNo, receiptPath, sniffImageType } from "@/lib/receipts";
import { refreshPayments } from "@/lib/refresh";
import { createClient } from "@/lib/supabase/server";

const no = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Attaches one receipt image to a payment. The phone has already shrunk it, but nothing here trusts that:
 * the type is read from the file's own bytes, the size and the 2-per-payment limit are checked again, and the
 * database function and the storage bucket refuse the same things a third time.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUser())) return no("Sign in again to attach a receipt.", 401);
  const { id } = await params;
  const committee = isUuid(id) ? await getCommittee(id) : null;
  if (!committee) return no("That committee was not found.", 404);
  if (committee.status !== "running") return no("Receipts can only be added while the committee is running.", 409);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return no("The upload could not be read. Try again.", 400);
  }
  const paymentId = String(form.get("paymentId") ?? "");
  const file = form.get("file");
  if (!isUuid(paymentId)) return no("That payment was not found.", 404);
  if (!(file instanceof File)) return no("Choose an image to attach.", 400);
  if (file.size > RECEIPT_MAX_BYTES) return no("That image is larger than 2 MB. Choose a smaller one.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return no("Only JPEG, PNG or WebP images can be attached.", 415);

  const supabase = await createClient();
  const payment = await supabase.from("payments_current").select("id").eq("id", paymentId).eq("committee_id", id).maybeSingle();
  if (payment.error) return no("We couldn't check the payment. Try again.", 502);
  if (!payment.data) return no("That payment was not found, or it was corrected.", 404);

  const existing = await supabase.from("receipts").select("slot_no").eq("payment_id", paymentId).is("removed_at", null);
  if (existing.error) return no("We couldn't check the receipts. Try again.", 502);
  const slotNo = freeSlotNo((existing.data ?? []).map((r) => r.slot_no));
  if (slotNo === null) return no("This payment already has 2 receipts. Remove one first.", 409);

  const path = receiptPath(id, paymentId, slotNo, type.ext);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const uploaded = await supabase.storage.from("receipts").upload(path, bytes, { contentType: type.mime, upsert: false });
  if (uploaded.error) {
    console.error("receipt upload failed:", uploaded.error.message);
    return no("We couldn't store the image. Nothing was attached. Try again.", 502);
  }

  const { data, error } = await supabase.rpc("attach_receipt", {
    p_committee_id: id,
    p_payment_id: paymentId,
    p_slot_no: slotNo,
    p_storage_path: path,
    p_sha256: sha256,
    p_mime: type.mime,
    p_size_bytes: file.size,
  });
  if (error) {
    // The file must not be left in the bucket without a record of it.
    await supabase.storage.from("receipts").remove([path]);
    return no(explainDbError(error, "attach the receipt"), 400);
  }

  refreshPayments(id);
  return NextResponse.json({ receiptId: data as string, slotNo }, { headers: { "Cache-Control": "no-store" } });
}
