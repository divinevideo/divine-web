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
  author_association?: string;
  body?: string;
};

type BlockerFixture =
  | 'closed'
  | 'open'
  | {
      pull_request?: { merged_at: string | null };
      state: 'closed' | 'open';
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
  missingBlockers = [],
  prNumber = 123,
  removeLabelError,
}: {
  blockerStates?: Record<number, BlockerFixture>;
  commentsByIssue?: Record<number, CommentFixture[]>;
  issues: IssueFixture[];
  missingBlockers?: number[];
  prNumber?: number;
  removeLabelError?: { status: number };
}) {
  const script = extractWorkflowScript();
  const missingBlockerNumbers = new Set(missingBlockers);
  const issueApi = {
    addLabels: vi.fn().mockResolvedValue({}),
    createComment: vi.fn().mockResolvedValue({}),
    createLabel: vi.fn().mockResolvedValue({}),
    get: vi.fn(async ({ issue_number }: { issue_number: number }) => {
      if (missingBlockerNumbers.has(issue_number)) {
        const error = new Error('Not Found') as Error & { status: number };
        error.status = 404;
        throw error;
      }

      const blockerState = blockerStates[issue_number] ?? 'open';
      const data = typeof blockerState === 'string' ? { state: blockerState } : blockerState;

      return { data };
    }),
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

  it('keeps an issue blocked when an Oxford-comma blocker list still has an open blocker', async () => {
    const issueApi = await runWorkflow({
      blockerStates: { 100: 'closed', 999: 'open' },
      issues: [
        {
          body: 'Blocked on #100, #123, and #999.',
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

  it('keeps an issue blocked when a wrapped blocker list still has an open blocker', async () => {
    const issueApi = await runWorkflow({
      blockerStates: { 100: 'closed', 999: 'open' },
      issues: [
        {
          body: 'Blocked on #100, #123,\n#456, and #999.',
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

  it('still ignores a quoted blocker reference on the line after a real one', async () => {
    const issueApi = await runWorkflow({
      blockerStates: { 999: 'open' },
      issues: [
        {
          body: 'Blocked on #123.\n> blocked on #999',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
    });

    expect(issueApi.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, labels: ['ready'] }),
    );
  });

  it('treats an unresolvable blocker reference as open', async () => {
    const issueApi = await runWorkflow({
      issues: [
        {
          body: 'Blocked on #123 and #999999.',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
      missingBlockers: [999999],
    });

    expect(issueApi.removeLabel).not.toHaveBeenCalled();
    expect(issueApi.addLabels).not.toHaveBeenCalled();
    expect(issueApi.createComment).not.toHaveBeenCalled();
  });

  it('continues processing issues after an unresolvable blocker reference', async () => {
    const issueApi = await runWorkflow({
      issues: [
        {
          body: 'Blocked on #123 and #999999.',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 41,
        },
        {
          body: 'Blocked on #123.',
          comments: 0,
          labels: [{ name: 'blocked' }],
          number: 42,
        },
      ],
      missingBlockers: [999999],
    });

    expect(issueApi.removeLabel).toHaveBeenCalledTimes(1);
    expect(issueApi.removeLabel).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, name: 'blocked' }),
    );
    expect(issueApi.addLabels).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, labels: ['ready'] }),
    );
  });

  it('ignores blocker references in untrusted comments', async () => {
    const issueApi = await runWorkflow({
      commentsByIssue: {
        42: [{ author_association: 'NONE', body: 'Blocked on #123.' }],
      },
      issues: [
        {
          body: '',
          comments: 1,
          labels: [],
          number: 42,
        },
      ],
    });

    expect(issueApi.removeLabel).not.toHaveBeenCalled();
    expect(issueApi.addLabels).not.toHaveBeenCalled();
    expect(issueApi.createComment).not.toHaveBeenCalled();
  });

  it('uses blocker references in trusted comments', async () => {
    const issueApi = await runWorkflow({
      commentsByIssue: {
        42: [{ author_association: 'MEMBER', body: 'Blocked on #123.' }],
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
  });

  it('ignores quoted and negated blocker references', async () => {
    const issueApi = await runWorkflow({
      issues: [
        {
          body: ['Not blocked on #123.', '> blocked on #123'].join('\n'),
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

  it('keeps an issue blocked when a blocker PR was closed without merging', async () => {
    const issueApi = await runWorkflow({
      blockerStates: {
        100: { pull_request: { merged_at: null }, state: 'closed' },
      },
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
      blockerStates: {
        100: { pull_request: { merged_at: '2026-08-15T18:45:37Z' }, state: 'closed' },
      },
      commentsByIssue: {
        42: [{ author_association: 'MEMBER', body: 'Blocked by PR #100 and #123.' }],
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
