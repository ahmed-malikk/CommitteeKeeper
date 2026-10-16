import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

/** The frame for pages anyone can open (landing, how it's built). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="iris" aria-hidden="true" style={{ viewTransitionName: "ck-iris" }} />
      <div className="pub">
        <header className="pubhead" style={{ viewTransitionName: "ck-pubhead" }}>
          <Link className="logo" href="/">
            <i />
            {site.name}
          </Link>
          <nav aria-label="Main">
            <Link className="btn secondary small" href="/committees">
              My committees
            </Link>
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
