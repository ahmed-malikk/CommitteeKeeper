import { site } from "@/lib/site";

// Placeholder home page. The real design (tokens, fonts, app shell) arrives with issue #3.
export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 16px" }}>
      <h1>{site.name}</h1>
      <p>{site.tagline}</p>
      <p>{site.description}</p>
    </main>
  );
}
