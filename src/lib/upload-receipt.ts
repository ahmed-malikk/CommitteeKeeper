// Runs in the browser only: shrink one image and send it to the server to attach to a payment.
import { imageProblem, shrinkImage } from "./shrink-image";

/** Attaches one image to a payment. Returns null on success, or a sentence saying what went wrong. */
export async function uploadReceipt(committeeId: string, paymentId: string, file: File): Promise<string | null> {
  const problem = imageProblem(file);
  if (problem) return problem;
  let small: File;
  try {
    small = await shrinkImage(file);
  } catch (e) {
    return e instanceof Error ? e.message : "That image couldn’t be prepared.";
  }
  const body = new FormData();
  body.set("paymentId", paymentId);
  body.set("file", small);
  try {
    const response = await fetch(`/committees/${committeeId}/receipts`, { method: "POST", body });
    if (response.ok) return null;
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "We couldn’t attach the image. Nothing was changed. Try again.";
  } catch {
    return "We couldn’t reach the server. Check the connection and try again.";
  }
}
