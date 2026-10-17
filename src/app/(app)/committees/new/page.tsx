import { NewCommitteeForm } from "@/components/NewCommitteeForm";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { firstOfNextMonth, todayInPakistan } from "@/lib/dates";

export const metadata = { title: "New committee" };

export default function NewCommittee() {
  return (
    <PageTransition>
      <div className="head">
        <div>
          <PopText text="New committee" />
          <div className="meta">
            <span>Set the agreement once. Everyone shares the same written rules.</span>
          </div>
        </div>
      </div>
      <div className="wizwrap rise" style={{ ["--i" as string]: 2 }}>
        <NewCommitteeForm defaultStart={firstOfNextMonth(todayInPakistan())} />
      </div>
    </PageTransition>
  );
}
