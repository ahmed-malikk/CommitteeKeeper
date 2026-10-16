import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { EmptyState } from "@/components/states";

export default function Committees() {
  return (
    <PageTransition>
      <div className="head">
        <PopText text="My committees" />
      </div>
      <div className="rise" style={{ ["--i" as string]: 2 }}>
        <EmptyState title="No committees yet">Committees you organise or belong to will appear here.</EmptyState>
      </div>
    </PageTransition>
  );
}
