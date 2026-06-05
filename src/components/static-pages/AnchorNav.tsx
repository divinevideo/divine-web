// ABOUTME: Shared "On this page" anchor navigation for static pages
// ABOUTME: Renders a grid of in-page jump links from a list of section anchors

import { cn } from "@/lib/utils";

export interface SectionAnchor {
  id: string;
  title: string;
}

interface AnchorNavProps {
  sections: SectionAnchor[];
  className?: string;
}

export function AnchorNav({ sections, className }: AnchorNavProps) {
  return (
    <nav
      aria-label="On this page"
      className={cn("mt-10 grid gap-2 sm:grid-cols-3 text-sm", className)}
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className="rounded-xl border border-brand-green/40 bg-brand-dark-green/40 px-4 py-3 text-brand-light-green hover:bg-brand-green/10 hover:border-brand-green transition-colors"
        >
          {s.title}
        </a>
      ))}
    </nav>
  );
}
