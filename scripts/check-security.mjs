// CommitteeKeeper: proves the database rules work by trying each action as each role.
// Run: node scripts/check-security.mjs     (reads .env.local; needs the three test accounts below)
//
// Needs in .env.local (git-ignored):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
//   CK_TEST_ORG_A_EMAIL / CK_TEST_ORG_A_PASSWORD     organiser A
//   CK_TEST_ORG_B_EMAIL / CK_TEST_ORG_B_PASSWORD     organiser B (a different person)
//   CK_TEST_MEMBER_EMAIL / CK_TEST_MEMBER_PASSWORD   an account that is only ever a member
// Create the three accounts by hand in Supabase (Authentication -> Add user, "Auto confirm"). No secret key is used.
//
// IMPORTANT: the history can never be deleted, so every run leaves one committee named "Security check"
// behind. Run this against the DEVELOPMENT database only. Before R1's trial, start the real database
// fresh (drop the schema, run the migrations again). All names here are made up.
//
// Each line prints PASS or FAIL; the script exits with an error code if anything failed.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => [line.slice(0, line.indexOf("=")).trim(), line.slice(line.indexOf("=") + 1).trim()]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const client = () => createClient(url, key, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}
// The action must be refused: the call returns an error (optionally containing some text).
async function refused(name, promise, contains) {
  const { error } = await promise;
  check(name, !!error && (!contains || error.message.includes(contains)), error?.message ?? "it was allowed");
}
// The action must work.
async function works(name, promise) {
  const { data, error } = await promise;
  check(name, !error, error?.message);
  return data;
}
async function signedIn(emailKey, passwordKey) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: env[emailKey], password: env[passwordKey] });
  if (error) throw new Error(`Could not sign in as ${env[emailKey]}: ${error.message}`);
  return c;
}

const anon = client();
const orgA = await signedIn("CK_TEST_ORG_A_EMAIL", "CK_TEST_ORG_A_PASSWORD");
const orgB = await signedIn("CK_TEST_ORG_B_EMAIL", "CK_TEST_ORG_B_PASSWORD");
const memberAcct = await signedIn("CK_TEST_MEMBER_EMAIL", "CK_TEST_MEMBER_PASSWORD");

// ── Build a small committee as organiser A: 3 slots, Rs 1,000, 3 periods, started in the past ──
console.log("\n-- Setting up a test committee as organiser A --");
const committeeId = await works(
  "A can create a committee",
  orgA.rpc("create_committee", {
    p_name: "Security check", p_amount: 1000, p_periods: 3, p_start_date: "2026-01-01",
    p_due_day: 5, p_grace_days: 0, p_order_method: "hand",
  }),
);
const memberId = {};
for (const [name, email] of [["Ali", "ali@example.test"], ["Sara", null], ["Bilal", null]]) {
  memberId[name] = await works(`A can add member ${name}`, orgA.rpc("add_member", {
    p_committee_id: committeeId, p_name: name, p_email: email, p_phone: null,
  }));
}
await refused(
  "A cannot start before slots exist, and gets the reasons",
  orgA.rpc("start_committee", { p_committee_id: committeeId }),
  "Add at least 2 slots",
);
const slotOf = {};
for (const name of ["Ali", "Bilal", "Sara"]) {
  slotOf[name] = await works(`A can add a slot for ${name}`, orgA.rpc("add_slot", {
    p_committee_id: committeeId, p_member_id: memberId[name],
  }));
}
await refused("A cannot add a 4th slot to a 3-period committee",
  orgA.rpc("add_slot", { p_committee_id: committeeId, p_member_id: memberId.Ali }));
await refused("A cannot start until the order is set",
  orgA.rpc("start_committee", { p_committee_id: committeeId }), "Set the turn order first");
await refused("The order must list every turn exactly once",
  orgA.rpc("set_order", { p_committee_id: committeeId, p_slot_ids: [slotOf.Ali, slotOf.Bilal] }));
await works("A can set the order by hand", orgA.rpc("set_order", {
  p_committee_id: committeeId, p_slot_ids: [slotOf.Ali, slotOf.Bilal, slotOf.Sara],
}));
await works("A can start the committee (past start date is fine)",
  orgA.rpc("start_committee", { p_committee_id: committeeId }));
await refused("A cannot start it twice", orgA.rpc("start_committee", { p_committee_id: committeeId }));
await refused("Amount and periods are fixed once running", orgA.rpc("update_settings", {
  p_committee_id: committeeId, p_name: "Security check", p_amount: 2000, p_periods: 3, p_start_date: "2026-01-01",
  p_due_day: 5, p_grace_days: 0, p_order_method: "hand", p_remind_before_days: 2, p_remind_late_every: 3,
  p_display_style: "rs", p_display_grouping: "western",
}));

// ── Payments ──
console.log("\n-- Payments --");
const pay = (slot, period, date = "2026-01-06", method = "cash") =>
  orgA.rpc("record_payment", {
    p_committee_id: committeeId, p_slot_id: slot, p_period: period, p_paid_on: date, p_method: method, p_note: "private note",
  });
const aliPayment = await works("A can record Ali's payment for period 1", pay(slotOf.Ali, 1));
await refused("The same slot and period cannot be paid twice", pay(slotOf.Ali, 1));
await refused("A payment date in the future is refused", pay(slotOf.Ali, 2, "2099-01-01"));
await refused("An unknown payment method is refused", pay(slotOf.Ali, 2, "2026-02-06", "barter"));
await refused("A period outside 1 to 3 is refused", pay(slotOf.Ali, 4));
await refused("Organiser B cannot record a payment in A's committee", orgB.rpc("record_payment", {
  p_committee_id: committeeId, p_slot_id: slotOf.Ali, p_period: 2, p_paid_on: "2026-02-06", p_method: "cash", p_note: null,
}), "Not allowed");
await refused("A signed-out visitor cannot record a payment", anon.rpc("record_payment", {
  p_committee_id: committeeId, p_slot_id: slotOf.Ali, p_period: 2, p_paid_on: "2026-02-06", p_method: "cash", p_note: null,
}));

const correction = await works("A can correct a payment (new row)", orgA.rpc("correct_payment", {
  p_committee_id: committeeId, p_payment_id: aliPayment, p_paid_on: "2026-01-07", p_method: "bank", p_note: null,
  p_cancel: false, p_reason: "wrong date",
}));
await refused("The old payment cannot be corrected a second time", orgA.rpc("correct_payment", {
  p_committee_id: committeeId, p_payment_id: aliPayment, p_paid_on: "2026-01-08", p_method: "bank",
}));
{
  const { data } = await orgA.from("payments").select("id").eq("committee_id", committeeId);
  const { data: current } = await orgA.from("payments_current").select("id").eq("committee_id", committeeId);
  check("Both rows are kept; only the correction counts",
    data?.length === 2 && current?.length === 1 && current[0].id === correction,
    `${data?.length} rows, ${current?.length} counted`);
}

// ── The history cannot be changed ──
console.log("\n-- History and records cannot be changed (TC-039) --");
await refused("A cannot UPDATE the history", orgA.from("ledger_events").update({ type: "settings_set" }).eq("committee_id", committeeId));
await refused("A cannot DELETE from the history", orgA.from("ledger_events").delete().eq("committee_id", committeeId));
await refused("A cannot INSERT into the history directly", orgA.from("ledger_events").insert({
  committee_id: committeeId, type: "payment_recorded", happened_on: "2026-01-01", payload: {}, seq: 1, recorded_at: new Date(), prev_hash: "x", hash: "x",
}));
await refused("A cannot UPDATE a payment", orgA.from("payments").update({ amount: 1 }).eq("committee_id", committeeId));
await refused("A cannot DELETE a payment", orgA.from("payments").delete().eq("committee_id", committeeId));
await refused("A cannot INSERT a payment directly", orgA.from("payments").insert({
  committee_id: committeeId, slot_id: slotOf.Sara, member_id: memberId.Sara, period: 1, amount: 1, paid_on: "2026-01-01", method: "cash",
}));
await refused("A cannot edit a slot or a member directly", orgA.from("slots").update({ paid_out: true }).eq("committee_id", committeeId));
await refused("A cannot edit a committee directly", orgA.from("committees").update({ amount: 1 }).eq("id", committeeId));
await refused("A signed-out visitor cannot INSERT into the history", anon.from("ledger_events").insert({ committee_id: committeeId }));
{
  const { data, error } = await orgA.rpc("verify_chain", { p_committee_id: committeeId });
  check("The chain check says ok", !error && data === "ok", error?.message ?? data);
}
await refused("B cannot run the chain check on A's committee", orgB.rpc("verify_chain", { p_committee_id: committeeId }));

// ── Who can read what ──
console.log("\n-- Reading (signed out, other organiser) --");
for (const table of ["committees", "members", "slots", "slot_holders", "payments", "receipts", "payouts", "ledger_events", "reminder_log", "profiles"]) {
  const { data, error } = await anon.from(table).select("*");
  check(`Signed out cannot read ${table}`, !!error || (data ?? []).length === 0, error?.message ?? `${data.length} rows`);
  const other = await orgB.from(table).select("*").limit(50);
  const leaked = (other.data ?? []).some((row) => row.committee_id === committeeId || row.id === committeeId);
  check(`B cannot read A's rows in ${table}`, !leaked, other.error?.message);
}
{
  const { data } = await orgA.from("members").select("name, email, link_token").eq("committee_id", committeeId);
  check("A can read their own members (and their links)", data?.length === 3 && data.every((m) => m.link_token));
}

// ── Member link ──
console.log("\n-- Member link (no account) --");
const { data: links } = await orgA.from("members").select("id, name, link_token").eq("committee_id", committeeId);
const tokenOf = Object.fromEntries(links.map((m) => [m.name, m.link_token]));
{
  const { data, error } = await anon.rpc("member_view", { p_token: tokenOf.Ali });
  const text = JSON.stringify(data ?? {});
  check("A valid link shows the member's own view", !error && data?.committee?.name === "Security check" && data?.me?.name === "Ali", error?.message);
  check("The link view shows Ali's own payment", data?.my_payments?.length === 1);
  check("The link view hides others' names by default", !text.includes("Sara") && !text.includes("Bilal"));
  check("The link view has no email, phone, note or token",
    !text.includes("ali@example.test") && !text.includes("private note") && !text.includes(tokenOf.Ali) && !text.includes("phone"));
}
for (const [label, token] of [["garbage", "not-a-real-token"], ["empty", ""]]) {
  const { data, error } = await anon.rpc("member_view", { p_token: token });
  check(`A ${label} link gives an empty answer`, !error && Object.keys(data ?? {}).length === 0, error?.message);
}
{
  const { data } = await anon.rpc("member_view", { p_token: tokenOf.Bilal });
  check("Bilal's link does not show Ali's payment", (data?.my_payments ?? []).length === 0);
}
await works("A can let members see the turn order", orgA.rpc("set_visibility", {
  p_committee_id: committeeId, p_payments: false, p_turns: true, p_history: false,
}));
{
  const { data } = await anon.rpc("member_view", { p_token: tokenOf.Bilal });
  const text = JSON.stringify(data ?? {});
  check("With the turn switch on, others' names show", text.includes("Sara") && Array.isArray(data?.all_turns));
  check("...but still no payment status", data?.payment_status === undefined);
}
await works("A can turn Ali's link off", orgA.rpc("set_member_link", { p_committee_id: committeeId, p_member_id: memberId.Ali, p_enabled: false }));
{
  const { data } = await anon.rpc("member_view", { p_token: tokenOf.Ali });
  check("A switched-off link gives the same empty answer", Object.keys(data ?? {}).length === 0);
}
await works("A can turn it back on", orgA.rpc("set_member_link", { p_committee_id: committeeId, p_member_id: memberId.Ali, p_enabled: true }));
await refused("B cannot manage A's member links",
  orgB.rpc("set_member_link", { p_committee_id: committeeId, p_member_id: memberId.Ali, p_enabled: false }), "Not allowed");
{
  const newToken = await works("A can make a new link for Bilal", orgA.rpc("new_member_link", { p_committee_id: committeeId, p_member_id: memberId.Bilal }));
  const old = await anon.rpc("member_view", { p_token: tokenOf.Bilal });
  const fresh = await anon.rpc("member_view", { p_token: newToken });
  check("The old link stops working, the new one works",
    Object.keys(old.data ?? {}).length === 0 && fresh.data?.me?.name === "Bilal");
  tokenOf.Bilal = newToken;
}

// ── Member account ──
console.log("\n-- Member with an account --");
{
  // The member account keeps its memberships from earlier runs (history is permanent), so count from here.
  const { data: before } = await memberAcct.rpc("member_home");
  check("member_home answers with a list", Array.isArray(before));
  const earlier = before?.length ?? 0;
  const { data: ok } = await memberAcct.rpc("attach_account", { p_token: tokenOf.Bilal });
  check("The account can attach to Bilal's link", ok === true);
  const { data: again } = await orgB.rpc("attach_account", { p_token: tokenOf.Bilal });
  check("Someone else cannot take over a link that is already attached", again === false);
  const { data: bad } = await memberAcct.rpc("attach_account", { p_token: "nope" });
  check("A wrong token does not attach", bad === false);
  const { data: home } = await memberAcct.rpc("member_home");
  const newest = home?.at(-1);
  check("member_home gains exactly one membership: Bilal's", home?.length === earlier + 1 && newest?.me?.name === "Bilal");
  check("...and none of Ali's payments", (newest?.my_payments ?? []).length === 0);
  check("...and every membership is a made-up test one", (home ?? []).every((h) => ["Ali", "Sara", "Bilal"].includes(h.me?.name)));
  const noTables = await memberAcct.from("members").select("*");
  check("The account has no direct table access", !!noTables.error || (noTables.data ?? []).length === 0);
  const noPay = await memberAcct.from("payments").select("*");
  check("...not even to payments", !!noPay.error || (noPay.data ?? []).length === 0);
  const { data: anonHome } = await anon.rpc("member_home");
  check("Signed out, member_home gives nothing", !anonHome || anonHome.length === 0);
}

// ── Receipts ──
console.log("\n-- Receipts --");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==", "base64");
const sha = createHash("sha256").update(png).digest("hex");
const folder = `${committeeId}/${correction}`; // the counted payment is the correction
const upload = (c, path) => c.storage.from("receipts").upload(path, png, { contentType: "image/png" });
await refused("B cannot upload into A's receipts folder", upload(orgB, `${folder}/1.png`));
await refused("A signed-out visitor cannot upload", upload(anon, `${folder}/1.png`));
await works("A can upload a receipt image", upload(orgA, `${folder}/1.png`));
await works("A can upload a second image", upload(orgA, `${folder}/2.png`));
await refused("A cannot upload to a path with the wrong shape", upload(orgA, `${committeeId}/loose.png`));
const attach = (n, path = `${folder}/${n}.png`, mime = "image/png", size = png.length) =>
  orgA.rpc("attach_receipt", {
    p_committee_id: committeeId, p_payment_id: correction, p_slot_no: n, p_storage_path: path, p_sha256: sha, p_mime: mime, p_size_bytes: size,
  });
const receipt1 = await works("A can register receipt 1", attach(1));
await works("A can register receipt 2", attach(2));

{
  // What a member can learn about receipts: their own, through their own link, and nothing else (US-20).
  const mine = await anon.rpc("member_receipt_paths", { p_token: tokenOf.Ali, p_payment_id: correction });
  check("Ali's link returns Ali's own two receipt paths", !mine.error && mine.data?.length === 2, mine.error?.message);
  const others = await anon.rpc("member_receipt_paths", { p_token: tokenOf.Bilal, p_payment_id: correction });
  check("Bilal's link returns none of Ali's receipts", !others.error && (others.data ?? []).length === 0, others.error?.message);
  const junk = await anon.rpc("member_receipt_paths", { p_token: "not-a-real-token", p_payment_id: correction });
  check("A wrong link returns no receipt paths", !junk.error && (junk.data ?? []).length === 0, junk.error?.message);
  const acct = await memberAcct.rpc("member_receipt_paths_account", { p_member_id: memberId.Bilal, p_payment_id: correction });
  check("A member account gets none of another member's receipts", !acct.error && (acct.data ?? []).length === 0, acct.error?.message);
  const direct = await anon.storage.from("receipts").createSignedUrl(`${folder}/1.png`, 60);
  check("A visitor cannot make a signed link to a receipt file", !!direct.error || !direct.data?.signedUrl, direct.error?.message);
}
await refused("A third receipt is refused", attach(3));
await refused("A PDF is refused", attach(1, `${folder}/1.pdf`, "application/pdf"), "check constraint");
await refused("A file over 2 MB is refused", attach(1, `${folder}/1.png`, "image/png", 3_000_000), "check constraint");
await refused("The old (corrected) payment takes no receipt", orgA.rpc("attach_receipt", {
  p_committee_id: committeeId, p_payment_id: aliPayment, p_slot_no: 1, p_storage_path: `${committeeId}/${aliPayment}/1.png`,
  p_sha256: sha, p_mime: "image/png", p_size_bytes: png.length,
}));
await refused("A file in someone else's folder is refused", orgA.rpc("attach_receipt", {
  p_committee_id: committeeId, p_payment_id: correction, p_slot_no: 1, p_storage_path: `${committeeId}/other/1.png`,
  p_sha256: sha, p_mime: "image/png", p_size_bytes: png.length,
}));
{
  const own = await anon.rpc("member_receipt_paths", { p_token: tokenOf.Ali, p_payment_id: correction });
  const other = await anon.rpc("member_receipt_paths", { p_token: tokenOf.Bilal, p_payment_id: correction });
  check("Ali's link finds Ali's receipts", own.data?.length === 2, JSON.stringify(own.data));
  check("Bilal's link finds none of them", (other.data ?? []).length === 0);
  const download = await memberAcct.storage.from("receipts").download(`${folder}/1.png`);
  check("A member cannot read the bucket directly", !!download.error);
  const anonDownload = await anon.storage.from("receipts").download(`${folder}/1.png`);
  check("A signed-out visitor cannot read the bucket", !!anonDownload.error);
  const bDownload = await orgB.storage.from("receipts").download(`${folder}/1.png`);
  check("Organiser B cannot read A's receipts", !!bDownload.error);
  const aDownload = await orgA.storage.from("receipts").download(`${folder}/1.png`);
  check("Organiser A can read their own receipts", !aDownload.error, aDownload.error?.message);
}
await refused("A cannot change a receipt row directly", orgA.from("receipts").update({ sha256: "0".repeat(64) }).eq("id", receipt1));
await refused("A cannot delete a receipt row", orgA.from("receipts").delete().eq("id", receipt1));
const removedPath = await works("A can remove a receipt", orgA.rpc("remove_receipt", { p_committee_id: committeeId, p_receipt_id: receipt1, p_reason: "wrong image" }));
check("Removing returns the file path for the server to delete", removedPath === `${folder}/1.png`);
await works("A removed receipt frees its place for a new one", attach(1));

// ── Turns, swaps, replacement, payouts ──
console.log("\n-- Turns, replacement and payouts --");
await refused("B cannot swap A's turns", orgB.rpc("swap_turns", { p_committee_id: committeeId, p_slot_a: slotOf.Bilal, p_slot_b: slotOf.Sara }), "Not allowed");
await works("A can swap two unpaid turns", orgA.rpc("swap_turns", { p_committee_id: committeeId, p_slot_a: slotOf.Bilal, p_slot_b: slotOf.Sara, p_reason: "agreed" }));
await refused("A draw is refused when the order method is 'by hand'", orgA.rpc("draw_all", { p_committee_id: committeeId }), "does not use");
await works("A can replace Sara with Bilal from period 3", orgA.rpc("replace_holder", {
  p_committee_id: committeeId, p_slot_id: slotOf.Sara, p_new_member_id: memberId.Bilal, p_from_period: 3, p_reason: "Sara left",
}));
await refused("The replacement must start after the current stretch began", orgA.rpc("replace_holder", {
  p_committee_id: committeeId, p_slot_id: slotOf.Sara, p_new_member_id: memberId.Ali, p_from_period: 1,
}));
{
  const { data } = await orgA.from("slot_holders").select("from_period, to_period, member_id").eq("slot_id", slotOf.Sara).order("from_period");
  check("The two holders cover the slot with no gap and no overlap",
    data?.length === 2 && data[0].from_period === 1 && data[0].to_period === 2 && data[1].from_period === 3 && data[1].to_period === null,
    JSON.stringify(data));
}
// Payouts. The pot is 3 x Rs 1,000 = Rs 3,000. The test passes the split itself; the real app computes it with splitPot.
const payout = (slot, split, date = "2026-03-10") =>
  orgA.rpc("record_payout", { p_committee_id: committeeId, p_slot_id: slot, p_paid_on: date, p_split: split });
await refused("A split that does not add up to the pot is refused", payout(slotOf.Ali, [{ member_id: memberId.Ali, amount: 2500 }]), "adds up");
await refused("A receiver who never held the slot is refused", payout(slotOf.Ali, [{ member_id: memberId.Sara, amount: 3000 }]));
await works("A can record Ali's payout", payout(slotOf.Ali, [{ member_id: memberId.Ali, amount: 3000 }]));
await refused("The same turn cannot be paid out twice", payout(slotOf.Ali, [{ member_id: memberId.Ali, amount: 3000 }]), "already");
await refused("A paid-out turn cannot be swapped", orgA.rpc("swap_turns", { p_committee_id: committeeId, p_slot_a: slotOf.Ali, p_slot_b: slotOf.Bilal }));
await refused("A paid-out turn cannot be moved by hand", orgA.rpc("set_order", { p_committee_id: committeeId, p_slot_ids: [slotOf.Sara, slotOf.Bilal, slotOf.Ali] }));
await refused("A paid-out slot cannot be removed (committee is running)", orgA.rpc("remove_slot", { p_committee_id: committeeId, p_slot_id: slotOf.Ali }));
await works("A can record Bilal's slot payout (swapped to place 3)", payout(slotOf.Bilal, [{ member_id: memberId.Bilal, amount: 3000 }]));
await works("A can record the split slot payout: Sara 2 periods, Bilal 1", payout(slotOf.Sara, [
  { member_id: memberId.Sara, amount: 2000 }, { member_id: memberId.Bilal, amount: 1000 },
]));

// ── Finishing ──
console.log("\n-- Finishing and read-only --");
await refused("Organiser B cannot complete A's committee", orgB.rpc("complete_committee", { p_committee_id: committeeId, p_settlement_note: "x" }), "Not allowed");
await refused("Completing with unrecorded payments needs a settlement note", orgA.rpc("complete_committee", { p_committee_id: committeeId }), "not recorded");
await works("A can complete it with a settlement note", orgA.rpc("complete_committee", { p_committee_id: committeeId, p_settlement_note: "security check" }));
const completedWrites = {
  "record a payment": orgA.rpc("record_payment", { p_committee_id: committeeId, p_slot_id: slotOf.Ali, p_period: 2, p_paid_on: "2026-02-06", p_method: "cash", p_note: null }),
  "correct a payment": orgA.rpc("correct_payment", { p_committee_id: committeeId, p_payment_id: correction, p_paid_on: "2026-01-09", p_method: "cash" }),
  "add a member": orgA.rpc("add_member", { p_committee_id: committeeId, p_name: "Late" }),
  "change visibility": orgA.rpc("set_visibility", { p_committee_id: committeeId, p_payments: true, p_turns: true, p_history: true }),
  "swap turns": orgA.rpc("swap_turns", { p_committee_id: committeeId, p_slot_a: slotOf.Ali, p_slot_b: slotOf.Bilal }),
  "replace a holder": orgA.rpc("replace_holder", { p_committee_id: committeeId, p_slot_id: slotOf.Ali, p_new_member_id: memberId.Sara, p_from_period: 2 }),
  "record a payout": orgA.rpc("record_payout", { p_committee_id: committeeId, p_slot_id: slotOf.Ali, p_paid_on: "2026-03-11", p_split: [] }),
  "attach a receipt": attach(2, `${folder}/2.png`),
  "turn a link off": orgA.rpc("set_member_link", { p_committee_id: committeeId, p_member_id: memberId.Ali, p_enabled: false }),
  "complete it again": orgA.rpc("complete_committee", { p_committee_id: committeeId, p_settlement_note: "again" }),
};
for (const [label, call] of Object.entries(completedWrites)) {
  await refused(`A completed committee refuses: ${label}`, call);
}
{
  const { data, error } = await orgA.rpc("verify_chain", { p_committee_id: committeeId });
  check("The chain is still ok at the end", !error && data === "ok", error?.message ?? data);
  const { data: log } = await orgA.from("ledger_events").select("seq, type").eq("committee_id", committeeId).order("seq");
  check("Entries are numbered 1, 2, 3 ... with no gap", log?.every((e, i) => e.seq === i + 1), `${log?.length} entries`);
  check("The history ends with committee_completed", log?.at(-1)?.type === "committee_completed");
}
{
  const { data } = await memberAcct.rpc("member_home");
  check("A member can still see a completed committee (read only)", data?.at(-1)?.committee?.status === "completed");
}

// ── A committee that has not started ──
console.log("\n-- A committee that has not started (TC-017) --");
{
  const forming = await works("A can create a second committee", orgA.rpc("create_committee", {
    p_name: "Security check 2", p_amount: 500, p_periods: 2, p_start_date: "2027-01-01", p_due_day: 1, p_grace_days: 0, p_order_method: "draw_start",
  }));
  await refused("It cannot be completed before it has started",
    orgA.rpc("complete_committee", { p_committee_id: forming }), "before it has started");
  await refused("Payments cannot be recorded before it starts", pay_forming(forming));
  await refused("Invalid settings are refused (amount 0)", orgA.rpc("create_committee", {
    p_name: "Bad", p_amount: 0, p_periods: 3, p_start_date: "2026-01-01", p_due_day: 5, p_grace_days: 0, p_order_method: "hand",
  }));
  await refused("Invalid settings are refused (31 periods)", orgA.rpc("create_committee", {
    p_name: "Bad", p_amount: 100, p_periods: 31, p_start_date: "2026-01-01", p_due_day: 5, p_grace_days: 0, p_order_method: "hand",
  }));
  await refused("Invalid settings are refused (1 period)", orgA.rpc("create_committee", {
    p_name: "Bad", p_amount: 100, p_periods: 1, p_start_date: "2026-01-01", p_due_day: 5, p_grace_days: 0, p_order_method: "hand",
  }));
  const m1 = await works("A can add two members", orgA.rpc("add_member", { p_committee_id: forming, p_name: "Zainab" }));
  const m2 = await orgA.rpc("add_member", { p_committee_id: forming, p_name: "Hamza" });
  const s1 = await orgA.rpc("add_slot", { p_committee_id: forming, p_member_id: m1 });
  const s2 = await orgA.rpc("add_slot", { p_committee_id: forming, p_member_id: m2.data });
  const drawn = await works("The start draw returns every slot exactly once", orgA.rpc("draw_all", { p_committee_id: forming }));
  check("...as a permutation of the slots", drawn?.length === 2 && new Set(drawn).size === 2 && [s1.data, s2.data].every((s) => drawn.includes(s)));
  await works("A second draw is a redo", orgA.rpc("draw_all", { p_committee_id: forming, p_reason: "redo" }));
  const { data: events } = await orgA.from("ledger_events").select("type").eq("committee_id", forming).in("type", ["draw_done", "draw_redone"]);
  check("Both draws are in the history (first and redo)", events?.some((e) => e.type === "draw_done") && events?.some((e) => e.type === "draw_redone"));
  await works("Before starting, a member can be removed once they hold no slot", (async () => {
    const extra = await orgA.rpc("add_member", { p_committee_id: forming, p_name: "Extra" });
    return orgA.rpc("remove_member", { p_committee_id: forming, p_member_id: extra.data });
  })());
  await refused("A member who holds a slot cannot be removed", orgA.rpc("remove_member", { p_committee_id: forming, p_member_id: m1 }));
}
function pay_forming(id) {
  return orgA.rpc("record_payment", { p_committee_id: id, p_slot_id: slotOf.Ali, p_period: 1, p_paid_on: "2026-01-06", p_method: "cash", p_note: null });
}

// ── Not covered here (done by hand in the SQL Editor, see check-tables-summary.sql and check-tables-details.sql) ──
console.log("\nBy hand in the SQL Editor: run check-tables-summary.sql (every table has row-level security, nobody has write rights),");
console.log("and the tamper test for verify_chain (instructions at the end of check-tables-details.sql).");

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
