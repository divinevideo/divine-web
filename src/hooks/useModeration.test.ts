import { describe, expect, it } from 'vitest';
import { toNip56ReportType, toNip32ReportLabel } from './useModeration';
import { ContentFilterReason } from '@/types/moderation';

describe('toNip56ReportType', () => {
  it('maps every ContentFilterReason to a valid NIP-56 type', () => {
    const validTypes = ['nudity', 'malware', 'profanity', 'illegal', 'spam', 'impersonation', 'other'];
    for (const reason of Object.values(ContentFilterReason)) {
      const result = toNip56ReportType(reason);
      expect(validTypes).toContain(result);
    }
  });

  it('aligns with mobile mappings', () => {
    expect(toNip56ReportType(ContentFilterReason.SPAM)).toBe('spam');
    expect(toNip56ReportType(ContentFilterReason.HARASSMENT)).toBe('profanity');
    expect(toNip56ReportType(ContentFilterReason.VIOLENCE)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.SEXUAL_CONTENT)).toBe('nudity');
    expect(toNip56ReportType(ContentFilterReason.COPYRIGHT)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.FALSE_INFO)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.CHILD_SAFETY)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.CSAM)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.UNDERAGE_USER)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.AI_GENERATED)).toBe('other');
    expect(toNip56ReportType(ContentFilterReason.IMPERSONATION)).toBe('impersonation');
    expect(toNip56ReportType(ContentFilterReason.ILLEGAL)).toBe('illegal');
    expect(toNip56ReportType(ContentFilterReason.OTHER)).toBe('other');
  });
});

describe('toNip32ReportLabel', () => {
  it('maps every ContentFilterReason to an NS-prefixed label', () => {
    for (const reason of Object.values(ContentFilterReason)) {
      const result = toNip32ReportLabel(reason);
      expect(result).toMatch(/^NS-/);
    }
  });

  it('uses camelCase values aligned with mobile', () => {
    expect(toNip32ReportLabel(ContentFilterReason.SEXUAL_CONTENT)).toBe('NS-sexualContent');
    expect(toNip32ReportLabel(ContentFilterReason.FALSE_INFO)).toBe('NS-falseInformation');
    expect(toNip32ReportLabel(ContentFilterReason.CHILD_SAFETY)).toBe('NS-childSafety');
    expect(toNip32ReportLabel(ContentFilterReason.CSAM)).toBe('NS-csam');
    expect(toNip32ReportLabel(ContentFilterReason.UNDERAGE_USER)).toBe('NS-underageUser');
    expect(toNip32ReportLabel(ContentFilterReason.AI_GENERATED)).toBe('NS-aiGenerated');
  });

  it('does not leak raw enum values like kebab-case', () => {
    expect(toNip32ReportLabel(ContentFilterReason.SEXUAL_CONTENT)).not.toContain('sexual-content');
    expect(toNip32ReportLabel(ContentFilterReason.FALSE_INFO)).not.toContain('false-info');
    expect(toNip32ReportLabel(ContentFilterReason.CHILD_SAFETY)).not.toContain('child-safety');
    expect(toNip32ReportLabel(ContentFilterReason.UNDERAGE_USER)).not.toContain('underage-user');
    expect(toNip32ReportLabel(ContentFilterReason.AI_GENERATED)).not.toContain('ai-generated');
  });
});
