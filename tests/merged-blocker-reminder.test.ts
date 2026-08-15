import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

type IssueFixture = {
  body?: string;
  comments?: number;
  labels?: Array<string | { name: string }>;
  number: number;
  pull_request?: unknown;
};

type CommentFixture = {
  body?: string;
};

function extractWorkflowScript(): string {
  const lines = readFileSync('.github/workflows/merged_blocker_reminder.yml', 'utf8').split('\n');
  const scriptStart = lines.findIndex((line) => line.trim() === 'script: |');

  if (scriptStart === -1) {
    throw new Error('No github-script block found');
  }

  return lines
    .slice(scriptStart + 1)
    .filter((line) => line.startsWith('            ') || line.trim() === '')
    .map((line) => line.replace(/^ {12}/, ''))
    .join('\n');
}

async function runWorkflow({
  blockerStates = {},
  commentsByIssue = {},
  issues,
  prNumber = 123,
  removeLabelError,
}: {
  blockerStates?: Record<number, 'open' | 'closed'>;
  commentsByIssue?: Record<number, CommentFixture[]>;
  issues: IssueFixture[];
  prNumber?: number;
  removeLabelError?: { status: number };
}) {
  const script = extractWorkflowScript();
  const issueApi = {
    addLabels: vi.fn().mockResolvedValue({}),
    createComment: vi.fn().mockResolvedValue({}),
    createLabel: vi.fn().mockResolvedValue({}),
    get: vi.fn(async ({ issue_number }: { issue_number: number }) => ({
      data: { state: blockerStates[issue_number] ?? 'open' },
    })),
    getLabel: vi.fn().mockResolvedValue({}),
    listComments: vi.fn(async ({ issue_number }: { issue_number: number }) => commentsByIssue[issue_number] ?? []),
    listForRepo: vi.fn().mockResolvedValue(issues),
    removeLabel: vi.fn(async () => {
      if (removeLabelError) {
        throw removeLabelError;
      }
      return {};
    }),
  };
  const github = {
    paginate: vi.fn((endpoint, params) => endpoint(params)),
    rest: { issues: issueApi },
  };
  const context = {
    payload: { pull_request: { number: prNumber } },
    repo: { owner: 'divinevideo', repo: 'divine-web' },
  };

  await new AsyncFunction('github', 'context', script)(github, context);

  return issueApi;
}

describe('merged blocker reminder workflow', () => {
  it('does not mark an issue ready while another referenced blocker is still open', async () => {
    const issueApi = await runWorkflow({
      blockerStates: { 100: 'open' },
      issues: [
        {
          body: 'Blocked on #100 and #123.',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
    });

    expect(issueApi.removeLabel).not.toHaveBeenCalled();
    expect(issueApi.addLabels).not.toHaveBeenCalled();
    expect(issueApi.createComment).not.toHaveBeenCalled();
  });

  it('marks an issue ready when every referenced blocker is closed', async () => {
    const issueApi = await runWorkflow({
      blockerStates: { 100: 'closed' },
      commentsByIssue: {
        42: [{ body: 'Blocked by PR #100 and #123.' }],
      },
      issues: [
        {
          body: '',
          comments: 1,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
    });

    expect(issueApi.removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, name: 'blocked' }),
    );
    expect(issueApi.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, labels: ['ready'] }),
    );
    expect(issueApi.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining('<!-- merged-blocker-reminder:123 -->'),
        issue_number: 42,
      }),
    );
  });

  it('tolerates a raced blocked-label removal', async () => {
    const issueApi = await runWorkflow({
      issues: [
        {
          body: 'Blocked on #123.',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
      removeLabelError: { status: 404 },
    });

    expect(issueApi.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, labels: ['ready'] }),
    );
    expect(issueApi.createComment).toHaveBeenCalled();
  });
});
