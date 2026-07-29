// ABOUTME: Dark hero for family child pages: eyebrow, h1, verbatim lead, and section nav slot
// ABOUTME: Mirrors the hub hero styling so the five pages read as one section of the site

import type { ReactNode } from "react";

import { FamilySectionNav } from "./FamilySectionNav";

interface FamilyPageHeroProps {
  icon: ReactNode;
  title: string;
  lead: string;
  eyebrow?: string;
}

export function FamilyPageHero({
  icon,
  title,
  lead,
  eyebrow = "For families on Divine",
}: FamilyPageHeroProps) {
  return (
    <section className="bg-brand-dark-green text-brand-off-white">
      <div className="container mx-auto px-4 py-14 md:py-20 max-w-5xl">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-brand-green mb-6">
          {icon}
          <span>{eyebrow}</span>
        </div>
        <h1 className="font-display font-extrabold tracking-tight text-4xl md:text-5xl leading-[1.05] text-brand-off-white mb-6">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-brand-light-green max-w-3xl leading-relaxed">
          {lead}
        </p>
        <FamilySectionNav className="mt-8 [&_a]:border-brand-green/40 [&_a]:text-brand-light-green" />
      </div>
    </section>
  );
}
