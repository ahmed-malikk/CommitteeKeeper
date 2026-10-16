import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "How it’s built" };

// Placeholder until issue #27 writes the real page.
export default function HowItsBuilt() {
  return (
    <PublicShell>
      <PageTransition>
        <div className="prose" style={{ paddingTop: 24 }}>
          <PopText text="How it’s built" />
          <p className="mut rise" style={{ ["--i" as string]: 3 }}>This page is being written.</p>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
