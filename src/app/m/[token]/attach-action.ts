"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { looksLikeToken } from "@/lib/member-view";
import { createClient } from "@/lib/supabase/server";

export type AttachState = { error: string | null };

/**
 * Attaches the signed-in account to the member behind a link, so that member's committees appear together at /me.
 * It works once per link; the database refuses a link that is already attached, switched off or unknown, and all
 * three get the same answer here. Nothing about the committee depends on this having been done.
 */
export async function attachAccount(_previous: AttachState, formData: FormData): Promise<AttachState> {
  const token = String(formData.get("token") ?? "");
  if (!(await getCurrentUser())) return { error: "Sign in first, then add this link to your account." };
  if (!looksLikeToken(token)) return { error: "This link couldn’t be added to your account." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("attach_account", { p_token: token });
  if (error) {
    console.error("attach_account failed:", error.code, error.message);
    return { error: "We couldn’t add this link. Check the connection and try again." };
  }
  if (data !== true) return { error: "This link couldn’t be added to your account. It may already belong to an account, or it may have stopped working." };
  redirect("/me");
}
