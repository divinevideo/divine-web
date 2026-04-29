// ABOUTME: Pure merge + cleanup for kind 0 profile JSON before publish (display_name sync, strip empty strings)

import type { NostrMetadata } from '@nostrify/nostrify';

/**
 * Merges relay metadata with form values, keeps display_name aligned with name,
 * and removes keys whose string value is empty so the published JSON omits them.
 */
export function mergeProfileMetadataForPublish(
  existing: NostrMetadata | undefined,
  formValues: NostrMetadata
): NostrMetadata {
  const data = {
    ...(existing ?? {}),
    ...formValues,
  } as Record<string, unknown>;

  if (data.name) {
    data.display_name = data.name;
  } else {
    delete data.display_name;
  }

  for (const key of Object.keys(data)) {
    if (data[key] === '') {
      delete data[key];
    }
  }

  return data as NostrMetadata;
}
