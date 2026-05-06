// ABOUTME: Submits structured bug reports to Zendesk via POST /api/report
// ABOUTME: Mirrors content report identity rules (pubkey or guest email)

import { useMutation } from '@tanstack/react-query';
import { submitBugReportToZendesk, type BugReportPayload } from '@/lib/reportApi';
import { inferOsVersionFromUserAgent } from '@/lib/bugReportZendesk';

export interface BugReportMutationInput {
  subject: string;
  description: string;
  stepsToReproduce?: string;
  expectedBehavior?: string;
  reporterPubkey?: string;
  reporterName?: string;
  reporterEmail?: string;
}

function readAppVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'unknown';
}

export function useBugReport() {
  return useMutation({
    mutationFn: async (input: BugReportMutationInput) => {
      const subject = input.subject.trim();
      const description = input.description.trim();
      if (!subject || !description) {
        throw new Error('Subject and description are required');
      }

      if (!input.reporterPubkey) {
        const email = input.reporterEmail?.trim() || '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error('A valid email is required when not signed in');
        }
      }

      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
      const appVersion = readAppVersion();
      const osVersion = inferOsVersionFromUserAgent(userAgent);

      const payload: BugReportPayload = {
        reportType: 'bug',
        subject,
        description,
        timestamp: Date.now(),
        stepsToReproduce: input.stepsToReproduce?.trim() || undefined,
        expectedBehavior: input.expectedBehavior?.trim() || undefined,
        pageUrl,
        userAgent,
        appVersion,
        osVersion,
        reporterPubkey: input.reporterPubkey,
        reporterName: input.reporterName,
        reporterEmail: input.reporterEmail?.trim() || undefined,
      };

      return submitBugReportToZendesk(payload);
    },
  });
}
