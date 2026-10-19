import { PageTransition } from "@/components/PageTransition";
import { PopText } from "@/components/PopText";
import { PublicShell } from "@/components/PublicShell";
import { ARCHITECTURE, BUILT_BY, CREDITS, LINKS, PROBLEM, STACK, STORY, TESTING, TESTS } from "@/content/howItsBuilt";

export const metadata = {
  title: "How it’s built",
  description: "Who built CommitteeKeeper, why, what it runs on, and how it is tested.",
};

/** The page for anyone who wants to know how CommitteeKeeper was made: the story, the problem, the stack, the tests and the links. */
export default function HowItsBuilt() {
  const Paragraphs = ({ items }: { items: string[] }) => (
    <>
      {items.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </>
  );
  return (
    <PublicShell>
      <PageTransition>
        <div className="prose hib" style={{ paddingTop: 24 }}>
          <PopText text="How it’s built" />
          <p className="mut rise" style={{ ["--i" as string]: 3 }}>
            For anyone who wants to see how this was made: who built it, why, and what is under it.
          </p>

          <section aria-labelledby="hib-who">
            <h2 id="hib-who">{BUILT_BY.heading}</h2>
            <Paragraphs items={BUILT_BY.paragraphs} />
          </section>

          <section aria-labelledby="hib-story">
            <h2 id="hib-story">{STORY.heading}</h2>
            <Paragraphs items={STORY.paragraphs} />
          </section>

          <section aria-labelledby="hib-problem">
            <h2 id="hib-problem">{PROBLEM.heading}</h2>
            <Paragraphs items={PROBLEM.paragraphs} />
            <ul>
              {PROBLEM.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="hib-stack">
            <h2 id="hib-stack">{STACK.heading}</h2>
            <dl className="hibstack">
              {STACK.rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="hib-arch">
            <h2 id="hib-arch">{ARCHITECTURE.heading}</h2>
            <Paragraphs items={ARCHITECTURE.paragraphs} />
          </section>

          <section aria-labelledby="hib-tests">
            <h2 id="hib-tests">{TESTING.heading}</h2>
            <Paragraphs items={TESTING.paragraphs} />
            <p>
              As of {TESTS.asOf}: <b>{TESTS.unit} unit tests</b> and <b>{TESTS.system} system tests</b> ({TESTS.browsers}).
            </p>
          </section>

          <section aria-labelledby="hib-links">
            <h2 id="hib-links">{LINKS.heading}</h2>
            <ul>
              {LINKS.items.map(([label, href]) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="hib-credits">
            <h2 id="hib-credits">{CREDITS.heading}</h2>
            <Paragraphs items={CREDITS.paragraphs} />
          </section>
        </div>
      </PageTransition>
    </PublicShell>
  );
}
