import { describe, expect, it } from 'vitest';
import { getVisiblePlaybackCount } from './playbackCount';

describe('getVisiblePlaybackCount', () => {
  it('sums native Divine loops and view starts so visible activity is not undercounted', () => {
    expect(getVisiblePlaybackCount({
      isVineMigrated: false,
      loopCount: 11,
      viewStartCount: 23,
    })).toBe(34);
  });

  it('falls back to view starts for native videos without loop data', () => {
    expect(getVisiblePlaybackCount({
      isVineMigrated: false,
      loopCount: 0,
      viewStartCount: 23,
    })).toBe(23);
  });

  it('keeps archived Vine display on original loop counts only', () => {
    expect(getVisiblePlaybackCount({
      isVineMigrated: true,
      loopCount: 296752,
      viewStartCount: 23,
    })).toBe(296752);
  });
});
