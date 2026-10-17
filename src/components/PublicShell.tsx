import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/dal";
import { site } from "@/lib/site";

/** The frame for pages anyone can open (landing, sign-in, how it's built). */
export async function PublicShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <div className="iris" aria-hidden="true" style={{ viewTransitionName: "ck-iris" }} />
      <div className="pub">
        <header className="pubhead" style={{ viewTransitionName: "ck-pubhead" }}>
          <Link className="logo" href="/">
            <i />
            <span className="name">{site.name}</span>
          </Link>
          <nav aria-label="Main" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user ? (
              <Link className="btn secondary small" href="/committees">
                My committees
              </Link>
            ) : (
              <>
                <Link className="btn ghost" href="/sign-in">
                  Sign in
                </Link>
                <Link className="btn primary small" href="/sign-up">
                  Create account
                </Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
        <footer className="foot">
          <Link href="/how-its-built">How it&rsquo;s built</Link>
          <span>{site.name} only keeps the record. It never holds or moves money.</span>
        </footer>
      </div>
    </>
  );
}
