import { describe, it, expect } from 'vitest';
import { toNip56ReportType } from './useModeration';
import { ContentFilterReason } from '@/types/moderation';

describe('toNip56ReportType', () => {
  const expectedMappings: [ContentFilterReason, string][] = [
    [ContentFilterReason.SPAM, 'spam'],
    [ContentFilterReason.HARASSMENT, 'profanity'],
    [ContentFilterReason.VIOLENCE, 'illegal'],
    [ContentFilterReason.SEXUAL_CONTENT, 'nudity'],
    [ContentFilterReason.COPYRIGHT, 'illegal'],
    [ContentFilterReason.FALSE_INFO, 'other'],
    [ContentFilterReason.CSAM, 'illegal'],
    [ContentFilterReason.AI_GENERATED, 'other'],
    [ContentFilterReason.IMPERSONATION, 'impersonation'],
    [ContentFilterReason.ILLEGAL, 'illegal'],
    [ContentFilterReason.OTHER, 'other'],
  ];

  it.each(expectedMappings)('maps %s to %s', (reason, expected) => {
    expect(toNip56ReportType(reason)).toBe(expected);
  });

  it('covers all ContentFilterReason values', () => {
    const allReasons = Object.values(ContentFilterReason);
    for (const reason of allReasons) {
      expect(toNip56ReportType(reason)).toBeDefined();
    }
  });
});
