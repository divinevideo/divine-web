// ABOUTME: Reusable section heading block for long static pages
// ABOUTME: Pairs eyebrow icons, display headings, and lead copy consistently

import type { ReactNode } from "react";

import { SectionHeader } from "@/components/brand/SectionHeader";

export function SectionHero({
  eyebrow,
  icon,
  title,
  lead,
}: {
  eyebrow: string;
  icon: ReactNode;
  title: string;
  lead: string;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-dark-green dark:text-brand-green mb-3">
        {icon}
        <span>{eyebrow}</span>
      </div>
      <SectionHeader as="h2" className="text-3xl md:text-4xl mb-4">
        {title}
      </SectionHeader>
      <p className="text-lg leading-relaxed text-muted-foreground max-w-3xl">
        {lead}
      </p>
    </div>
  );
}
