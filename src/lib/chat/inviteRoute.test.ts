import { describe, expect, it } from 'vitest';
import fixture from '../../../test-fixtures/concord/community-interop.json';
import { classifyInvitePath, parseInviteUrl } from './invite';

const invite = new URL(fixture.inviteUrl);
const code = invite.pathname.split('/').at(-1)!;

describe('router-normalized invite parsing', () => {
  it.each([invite.pathname, invite.pathname.replace('naddr1', 'n%61ddr1'), invite.pathname.replace('/invite/', '/INVITE/')])('uses the decoded router locator from %s', path => {
    expect(parseInviteUrl(path, invite.hash)?.naddr).toBe(code);
    expect(classifyInvitePath(path).real).toBe(true);
  });
  it('decodes the locator once instead of promoting double-encoded prefixes to real invites', () => {
    const path = invite.pathname.replace('naddr1', 'n%2561ddr1');
    expect(parseInviteUrl(path, invite.hash)?.naddr).toBe(code.replace('naddr1', 'n%61ddr1'));
    expect(classifyInvitePath(path).real).toBe(false);
  });
});
