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
  it('keeps every locale aligned with the english namespaces', () => {
    for (const [namespace, englishCatalog] of Object.entries(resources.en)) {
      const englishKeys = flattenKeys(englishCatalog).sort();

      for (const [locale, namespaces] of Object.entries(resources)) {
        const localeCatalog = namespaces[namespace as keyof typeof namespaces];
        const localeKeys = new Set(flattenKeys(localeCatalog));
        const missingKeys = englishKeys.filter((key) => !localeKeys.has(key));

        expect(
          missingKeys,
          `${locale}.${namespace} is missing keys:\n${missingKeys.join('\n')}`,
        ).toEqual([]);
      }
    }
  });
});
