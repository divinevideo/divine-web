import { describe, it, expect } from 'vitest';
import {
  EXTENDED_SORT_MODES,
  SEARCH_SORT_MODES,
  POPULAR_PERIODS,
} from './sortModes';

describe('sortModes constants', () => {
  it('EXTENDED_SORT_MODES contains popular and not controversial', () => {
    const values = EXTENDED_SORT_MODES.map(m => m.value);
    expect(values).toContain('popular');
    expect(values).not.toContain('controversial');
  });

  it('EXTENDED_SORT_MODES places popular between rising and classic', () => {
    const values = EXTENDED_SORT_MODES.map(m => m.value);
    const rising = values.indexOf('rising');
    const popular = values.indexOf('popular');
    const classic = values.indexOf('classic');
    expect(rising).toBeGreaterThanOrEqual(0);
    expect(popular).toBe(rising + 1);
    expect(classic).toBe(popular + 1);
  });

  it('SEARCH_SORT_MODES does not contain controversial', () => {
    const values = SEARCH_SORT_MODES.map(m => m.value);
    expect(values).not.toContain('controversial');
  });

  it('POPULAR_PERIODS contains the five expected windows in order', () => {
    expect(POPULAR_PERIODS.map(p => p.value)).toEqual(['now', 'today', 'week', 'month', 'all']);
  });
});
