import { AuthForm } from "@/components/AuthForm";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";
import { safeNext } from "@/lib/access";

export const metadata = { title: "Create your account" };

export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <PublicShell>
      <PageTransition>
        <div className="authcard">
          <PopText text="Create your account" />
          <p className="mut rise" style={{ ["--i" as string]: 3, marginBottom: 20 }}>
            Organisers create committees. Members can sign up later to see their own turn and payments in one place.
          </p>
          <div className="rise" style={{ ["--i" as string]: 4 }}>
            <AuthForm mode="sign-up" next={next} />
          </div>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
