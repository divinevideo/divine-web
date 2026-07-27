// ABOUTME: Horizontally scrollable member context for a public people list

import { PeopleListMember } from '@/components/PeopleListMember';
import { SectionHeader } from '@/components/brand/SectionHeader';
import { useBatchedAuthors } from '@/hooks/useBatchedAuthors';

export function PeopleListMembers({ pubkeys }: { pubkeys: string[] }) {
  const { data: authors = {} } = useBatchedAuthors(pubkeys);

  return (
    <section aria-labelledby="people-list-members-heading" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionHeader id="people-list-members-heading" className="text-xl">People</SectionHeader>
        <span className="text-sm text-muted-foreground">
          {pubkeys.length} {pubkeys.length === 1 ? 'person' : 'people'}
        </span>
      </div>
      {pubkeys.length > 0 ? (
        <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-3 scrollbar-hide">
          {pubkeys.map((pubkey) => (
            <PeopleListMember
              key={pubkey}
              pubkey={pubkey}
              metadata={authors[pubkey]?.metadata}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">
          Nobody&apos;s in this list yet.
        </p>
      )}
    </section>
  );
}
