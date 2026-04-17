import { describe, expect, it } from 'vitest';
import {
  buildBugReportCommentBody,
  inferOsVersionFromUserAgent,
  reportBuildNumberFromAppVersion,
} from '@/lib/bugReportZendesk';

describe('reportBuildNumberFromAppVersion', () => {
  it('returns suffix after plus', () => {
    expect(reportBuildNumberFromAppVersion('1.2.3+456')).toBe('456');
  });

  it('returns whole string when no plus', () => {
    expect(reportBuildNumberFromAppVersion('1.2.3')).toBe('1.2.3');
  });

  it('handles missing', () => {
    expect(reportBuildNumberFromAppVersion(undefined)).toBe('unknown');
  });
});

describe('inferOsVersionFromUserAgent', () => {
  it('detects macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(inferOsVersionFromUserAgent(ua)).toContain('macOS');
  });

  it('returns web for empty', () => {
    expect(inferOsVersionFromUserAgent('')).toBe('web');
  });
});

describe('buildBugReportCommentBody', () => {
  it('includes subject, description, and environment', () => {
    const body = buildBugReportCommentBody(
      'Crash on load',
      'The page goes white.',
      {
        appVersion: '0.0.0+abc',
        stepsToReproduce: '',
        expectedBehavior: '',
        pageUrl: 'https://divine.video/support',
        userAgent: 'Mozilla/5.0',
        logsSummary: '',
      },
    );
    expect(body).toContain('Crash on load');
    expect(body).toContain('The page goes white.');
    expect(body).toContain('https://divine.video/support');
    expect(body).toContain('Mozilla/5.0');
  });

  it('includes optional sections when set', () => {
    const body = buildBugReportCommentBody('S', 'D', {
      appVersion: '1',
      stepsToReproduce: 'tap x',
      expectedBehavior: 'no crash',
      pageUrl: '',
      userAgent: '',
      logsSummary: 'err: boom',
    });
    expect(body).toContain('### Steps to Reproduce');
    expect(body).toContain('tap x');
    expect(body).toContain('### Expected Behavior');
    expect(body).toContain('no crash');
    expect(body).toContain('boom');
  });
});
