import { describe, expect, it } from 'vitest';
import { resources } from './index';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(nested, nextPrefix);
  });
}

describe('i18n locale resources', () => {
  it('keeps every locale aligned with the english common namespace', () => {
    const englishKeys = flattenKeys(resources.en.common).sort();

    for (const [locale, namespaces] of Object.entries(resources)) {
      const localeKeys = new Set(flattenKeys(namespaces.common));
      const missingKeys = englishKeys.filter((key) => !localeKeys.has(key));

      expect(
        missingKeys,
        `${locale} is missing keys:\n${missingKeys.join('\n')}`,
      ).toEqual([]);
    }
  });
});
