import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "Privacy", description: "What CommitteeKeeper stores about you, who can see it, and what the permanent history means for deleting things." };

/**
 * What is stored, who can see it, and what "permanent" means. Written from what the database really does (migrations 001 to 008),
 * so every sentence here can be checked against the code.
 */
export default function PrivacyPage() {
  return (
    <PublicShell>
      <PageTransition>
        <div className="prose privacy" style={{ paddingTop: 24 }}>
          <PopText text="Privacy" />
          <p className="mut rise" style={{ ["--i" as string]: 3 }}>
            What CommitteeKeeper stores about you, who can see it, and why. It only keeps a record. It never holds or moves money.
          </p>

          <h2>What is stored</h2>
          <h3>If you organise a committee</h3>
          <ul>
            <li>Your email address and a password (the password is kept only as a one-way scramble, never in readable form).</li>
            <li>Each committee you create: its name, amount, number of months, start date, due day, grace days, how turns are decided, and what members may see.</li>
            <li>Each member&rsquo;s name, and an email and phone number only if you choose to add them, and a private link for each member.</li>
            <li>Every payment (month, date paid, method, an optional note), up to two receipt images per payment, every payout, and the history of everything that happened.</li>
          </ul>
          <h3>If you are a member</h3>
          <ul>
            <li>Your name, and an email and phone number only if your organiser added them. Your organiser chose these, not you.</li>
            <li>Your turn or turns, your payments and your receipts.</li>
            <li>If you sign in to keep your committees together: your email address and password, and which of your links you attached.</li>
          </ul>
          <h3>What is not stored</h3>
          <p>
            No bank or card details, no ID card numbers, no location, no advertising or tracking cookies and no analytics. The only cookies are the ones that keep you signed in.
          </p>

          <h2>Who can see it</h2>
          <ul>
            <li>
              <b>The organiser</b> can see everything in their own committees, including member phone numbers and emails. Nobody else can see an organiser&rsquo;s committees.
            </li>
            <li>
              <b>A member</b> always sees their own turn, the months left, the committee&rsquo;s status, their own payments and their own receipts. They see other members&rsquo; payment status, the order of turns and history entries about themselves only if the organiser switched those on. They never see anyone&rsquo;s email, phone number or private link, or anyone else&rsquo;s receipts.
            </li>
            <li>
              <b>A private link</b> shows only the member it belongs to. A wrong, unknown or switched-off link gives the same empty answer, so nobody can tell whether a link exists.
            </li>
            <li>
              <b>The person who runs this service</b> can technically reach the database as its administrator. Nothing is sold or shared with anyone else.
            </li>
          </ul>

          <h2>Why the history is permanent</h2>
          <p>
            A kameti runs on trust, and the history is how that trust is kept. Every entry is written once and can never be edited or deleted, by the organiser or by anyone else: the database refuses it. A mistake is fixed by adding a correction that points to the original, and both stay visible. Each entry also carries a fingerprint of the one before it, so a quiet change anywhere would show up.
          </p>
          <h3>What this means for deleting things</h3>
          <ul>
            <li>A member&rsquo;s name stays in the history entries about them. That is the price of a record nobody can quietly change.</li>
            <li>An organiser can remove a member&rsquo;s email and phone number at any time by editing their details, and can switch a member&rsquo;s link off or replace it. Those stop being shown; the history entries stay.</li>
            <li>Receipt images can be removed. The file is deleted, and the history keeps only a fingerprint that shows a receipt existed.</li>
            <li>There is no automatic deletion yet. If you want something removed that the organiser cannot remove, ask the organiser of your committee first.</li>
          </ul>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
