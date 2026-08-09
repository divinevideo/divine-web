export const PEOPLE_LIST_KIND = 30000;

export const RESERVED_PEOPLE_LIST_D_TAGS = ['block'] as const;

export function isReservedPeopleListDTag(dTag: string): boolean {
  return RESERVED_PEOPLE_LIST_D_TAGS.includes(dTag as typeof RESERVED_PEOPLE_LIST_D_TAGS[number]);
}

export function slugifyPeopleListName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
