import type { ReactNode } from "react";

// STYLE.md §2 — "Forum/thread title" size (Newsreader, 1.5rem/text-2xl, 600).
export function PageHeading({ children }: { children: ReactNode }) {
  return <h1 className="font-serif text-2xl font-semibold text-ink">{children}</h1>;
}
