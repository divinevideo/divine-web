// ABOUTME: Client-side helpers for structured Zendesk bug reports (divine-web)
// ABOUTME: Field IDs sync with divine-mobile ZendeskSupportService.createStructuredBugReport

export const ZD_BUG_FORM_ID = 14772963437071;
export const ZD_FIELD_TICKET_TYPE = 14332953477519;
export const ZD_FIELD_PLATFORM = 14884176561807;
export const ZD_FIELD_OS_VERSION = 14884157556111;
export const ZD_FIELD_BUILD = 14884184890511;
export const ZD_FIELD_STEPS = 14677364166031;
export const ZD_FIELD_EXPECTED = 14677341431695;

export function reportBuildNumberFromAppVersion(appVersion: string | undefined): string {
  if (!appVersion || typeof appVersion !== 'string') return 'unknown';
  const plus = appVersion.indexOf('+');
  return plus >= 0 ? appVersion.slice(plus + 1) : appVersion;
}

/** Short OS label for Zendesk custom field (best-effort from UA). */
export function inferOsVersionFromUserAgent(userAgent: string | undefined): string {
  if (!userAgent || !userAgent.trim()) return 'web';
  const ua = userAgent;
  if (/Windows NT 10/i.test(ua)) return 'Windows 10+';
  if (/Windows NT/i.test(ua)) return 'Windows';
  const mac = ua.match(/Mac OS X ([\d_]+)/i);
  if (mac?.[1]) return `macOS ${mac[1].replace(/_/g, '.')}`;
  if (/iPhone|iPad|iPod/.test(ua)) {
    const ios = ua.match(/OS ([\d_]+)/i);
    if (ios?.[1]) return `iOS ${ios[1].replace(/_/g, '.')}`;
  }
  const android = ua.match(/Android ([\d.]+)/i);
  if (android?.[1]) return `Android ${android[1]}`;
  if (/Linux/.test(ua)) return 'Linux';
  return 'web';
}

export interface BugReportCommentMeta {
  appVersion: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  pageUrl: string;
  userAgent: string;
  logsSummary: string;
}

export function buildBugReportCommentBody(
  effectiveSubject: string,
  description: string,
  meta: BugReportCommentMeta,
): string {
  const lines = [effectiveSubject, '', description, '', `App Version: ${meta.appVersion || 'unknown'}`, ''];
  if (meta.stepsToReproduce.trim()) {
    lines.push('### Steps to Reproduce', meta.stepsToReproduce.trim(), '');
  }
  if (meta.expectedBehavior.trim()) {
    lines.push('### Expected Behavior', meta.expectedBehavior.trim(), '');
  }
  lines.push('### Environment');
  lines.push(`- **Page URL:** ${meta.pageUrl || 'n/a'}`);
  lines.push(`- **User-Agent:** ${meta.userAgent || 'n/a'}`);
  if (meta.logsSummary.trim()) {
    lines.push('', '### Recent Logs', '```', meta.logsSummary.trim(), '```');
  }
  return lines.join('\n');
}
