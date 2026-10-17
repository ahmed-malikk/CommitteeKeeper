import { AuthForm } from "@/components/AuthForm";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "Create your account" };

export default function SignUp() {
  return (
    <PublicShell>
      <PageTransition>
        <div className="authcard">
          <PopText text="Create your account" />
          <p className="mut rise" style={{ ["--i" as string]: 3, marginBottom: 20 }}>
            Organisers create committees. Members can sign up later to see their own turn and payments in one place.
          </p>
          <div className="rise" style={{ ["--i" as string]: 4 }}>
            <AuthForm mode="sign-up" />
          </div>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
