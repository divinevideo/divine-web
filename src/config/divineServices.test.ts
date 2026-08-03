import { describe, expect, it } from 'vitest';

import { DIVINE_SERVICES } from './divineServices';

describe('DIVINE_SERVICES', () => {
  it('lists each service with a unique id, name, https URL, and icon', () => {
    const ids = DIVINE_SERVICES.map((service) => service.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const service of DIVINE_SERVICES) {
      expect(service.name.length).toBeGreaterThan(0);
      expect(service.url).toMatch(/^https:\/\//);
      expect(service.icon).toBeTruthy();
    }
  });

  it('includes the six launch services in display order', () => {
    expect(DIVINE_SERVICES.map((service) => service.id)).toEqual([
      'space',
      'sounds',
      'badges',
      'crossposter',
      'verifier',
      'status',
    ]);
  });
});
