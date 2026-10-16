"use client";

import { ErrorNote } from "@/components/states";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="stack">
      <ErrorNote>
        We couldn&rsquo;t load this page. Nothing was changed.{" "}
        <button className="btn ghost small" onClick={reset}>
          Try again
        </button>
      </ErrorNote>
    </div>
  );
}
