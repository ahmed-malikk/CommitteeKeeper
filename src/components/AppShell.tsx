"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export type Tab = { href: string; label: string; icon: IconName };

function NavLink({ href, icon, children }: { href: string; icon: IconName; children: ReactNode }) {
  const pathname = usePathname();
  const on = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link className={`nav${on ? " on" : ""}`} href={href} aria-current={on ? "page" : undefined}>
      <Icon name={icon} />
      {children}
    </Link>
  );
}

/**
 * The rail's links, with one highlight that slides from the old page's link to the new one.
 * Until the highlight has been measured (first paint, or no scripts) the active link draws its own background,
 * so the current page is never unmarked.
 */
function RailNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ y: number; h: number } | null>(null);
  const [slide, setSlide] = useState(false); // the highlight may only glide after its first placement

  useLayoutEffect(() => {
    const nav = ref.current;
    if (!nav) return;
    const place = () => {
      const active = nav.querySelector<HTMLElement>("a.nav.on");
      setPill(active ? { y: active.offsetTop, h: active.offsetHeight } : null);
    };
    place();
    const frame = requestAnimationFrame(() => setSlide(true));
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", place);
    };
  }, [pathname]);

  return (
    <nav ref={ref} className="rail" aria-label="Main" data-pill={pill ? "on" : undefined} data-slide={slide ? "on" : undefined} style={{ viewTransitionName: "ck-rail" }}>
      <span className="pill" aria-hidden="true" style={pill ? { transform: `translateY(${pill.y}px)`, height: pill.h, opacity: 1 } : undefined} />
      {children}
    </nav>
  );
}

/**
 * The frame around every signed-in page: a deep-teal rail on a laptop; a top bar (and, inside a committee,
 * a bottom tab bar) on a phone. `title` is the phone top bar's heading; `tabs` is the phone tab bar.
 * The rail, top bar, tab bar and iris band have fixed view-transition names, so they stay still while
 * the page content slides between routes.
 */
export function AppShell({ children, title = "My committees", tabs }: { children: ReactNode; title?: string; tabs?: Tab[] }) {
  const pathname = usePathname();
  const activeTab = tabs ? tabs.findIndex((tab) => pathname.startsWith(tab.href)) : -1;
  return (
    <>
      <div className="iris" aria-hidden="true" style={{ viewTransitionName: "ck-iris" }} />
      <div className="shell">
        <RailNav>
          <Link className="logo" href="/committees">
            <i />
            CommitteeKeeper
          </Link>
          <NavLink href="/committees" icon="layers">
            My committees
          </NavLink>
          <div className="grp">Account</div>
          <NavLink href="/how-its-built" icon="list">
            How it&rsquo;s built
          </NavLink>
        </RailNav>
        <div className="main">
          <div className="topbar" style={{ viewTransitionName: "ck-topbar" }}>
            <Link href="/committees">
              <span className="logo" style={{ margin: 0 }}>
                <i />
              </span>
              <span className="ttl">{title}</span>
            </Link>
            <Link className="how" href="/how-its-built" aria-label="How it's built">
              <Icon name="list" />
            </Link>
          </div>
          <main className="page">
            <div className="wash" aria-hidden="true" />
            {children}
          </main>
          {tabs ? (
            <nav className="tabbar" aria-label="Sections" style={{ viewTransitionName: "ck-tabbar", ["--tabs" as string]: tabs.length, ["--tab" as string]: Math.max(activeTab, 0) }}>
              <span className="tabmark" aria-hidden="true" data-none={activeTab < 0 ? "" : undefined} />
              {tabs.map((tab) => (
                <Link key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? "on" : undefined}>
                  <Icon name={tab.icon} />
                  {tab.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}
