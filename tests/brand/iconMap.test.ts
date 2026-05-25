import { describe, it, expect } from 'vitest';
import * as Phosphor from '@phosphor-icons/react';
import { ICON_MAP } from '@/lib/iconMap';

describe('Lucide → Phosphor iconMap', () => {
  it('every Phosphor target in the map exists in @phosphor-icons/react', () => {
    const missing: string[] = [];
    for (const [lucide, phosphor] of Object.entries(ICON_MAP)) {
      if (!(phosphor in Phosphor)) missing.push(`${lucide} → ${phosphor}`);
    }
    expect(missing).toEqual([]);
  });

  it('has no duplicate keys (TypeScript would catch but guard anyway)', () => {
    const keys = Object.keys(ICON_MAP);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
