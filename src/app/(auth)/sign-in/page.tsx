import { AuthForm } from "@/components/AuthForm";
import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";

export const metadata = { title: "Sign in" };

export default function SignIn() {
  return (
    <PublicShell>
      <PageTransition>
        <div className="authcard">
          <PopText text="Sign in" />
          <p className="mut rise" style={{ ["--i" as string]: 2, marginBottom: 20 }}>
            Welcome back.
          </p>
          <div className="rise" style={{ ["--i" as string]: 3 }}>
            <AuthForm mode="sign-in" />
          </div>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
