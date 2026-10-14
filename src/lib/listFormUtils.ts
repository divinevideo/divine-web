export function slugifyListName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function isValidOptionalUrl(url: string): boolean {
  if (!url) return true;

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
