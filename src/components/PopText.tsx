import type { ElementType } from "react";

/**
 * A heading whose words pop in one after another (rise, sharpen, fade). The full text stays in the page for
 * screen readers; the animated copy is hidden from them so the heading is not read twice. The pop is pure CSS,
 * so the words are visible even if scripts fail, and prefers-reduced-motion turns it into a plain fade.
 */
export function PopText({ as: Tag = "h1", text }: { as?: ElementType; text: string }) {
  const words = text.split(" ");
  return (
    <Tag>
      <span className="sr">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 ? " " : null}
            <span className="pw" style={{ ["--i" as string]: i }}>
              {word}
            </span>
          </span>
        ))}
      </span>
    </Tag>
  );
}
