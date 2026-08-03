// ABOUTME: Renders the outside-resources link cards for family pages
// ABOUTME: Hub shows all groups; child pages pass `include` to show the relevant subset

import { ArrowSquareOut, BookOpenText } from "@phosphor-icons/react";

import { Anchor, SectionHero, staticPageLinkCardClass } from "@/components/static-pages";

import { RESOURCE_GROUPS, type ResourceGroup } from "./resourcesData";

interface FamilyResourcesProps {
  /** Group keys to render; omit for all groups (hub) */
  include?: ResourceGroup["key"][];
}

export function FamilyResources({ include }: FamilyResourcesProps) {
  const groups = include
    ? RESOURCE_GROUPS.filter((g) => include.includes(g.key))
    : RESOURCE_GROUPS;

  return (
    <Anchor id="resources">
      <SectionHero
        eyebrow="Outside resources"
        icon={<BookOpenText weight="fill" className="h-7 w-7" />}
        title="But you don't have to take our word for it"
        lead="These are some resources we recommend. Inclusion here doesn't imply endorsement of every recommendation from these organizations. Read them with the same critical eye you'd bring to any single source—including this one. A few are global; most are from North American or UK sources."
      />

      <div className="space-y-10">
        {groups.map((group) => (
          <div key={group.heading}>
            <h3 className="font-display font-extrabold tracking-tight text-xl text-brand-dark-green dark:text-brand-off-white mb-4">
              {group.heading}
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              {group.links.map((r) => (
                <a
                  key={r.url}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={staticPageLinkCardClass("green")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-display font-extrabold tracking-tight text-lg text-brand-dark-green dark:text-brand-off-white">
                      {r.name}
                    </h4>
                    <ArrowSquareOut className="h-5 w-5 flex-shrink-0 text-brand-dark-green dark:text-brand-green group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {r.description}
                  </p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Anchor>
  );
}
