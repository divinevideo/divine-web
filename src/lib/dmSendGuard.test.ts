import { describe, expect, it, vi } from 'vitest';
import {
  assertMinorDmRecipientsAllowed,
  DmSendBlockedError,
  DmSendUnverifiedError,
  isDmComposeBlockedForMinor,
} from './dmSendGuard';

const HQ = 'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
const STRANGER = 'de'.repeat(32);

function serviceApproving(approved: Set<string>) {
  return {
    isApprovedMinorDmRecipient: vi.fn(async (hex: string) => approved.has(hex)),
  };
}

describe('assertMinorDmRecipientsAllowed', () => {
  it('is a no-op for a positively not-protected user (never consults the service)', async () => {
    const service = serviceApproving(new Set());
    await assertMinorDmRecipientsAllowed([STRANGER], {
      state: 'not_protected',
      service,
    });
    expect(service.isApprovedMinorDmRecipient).not.toHaveBeenCalled();
  });

  it('resolves when a protected minor sends to all-approved recipients', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([HQ], { state: 'protected', service }),
    ).resolves.toBeUndefined();
  });

  it('throws DmSendBlockedError when any recipient is not approved (group all-or-nothing)', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([HQ, STRANGER], {
        state: 'protected',
        service,
      }),
    ).rejects.toBeInstanceOf(DmSendBlockedError);
  });

  it('fails closed on unknown: throws DmSendUnverifiedError for a non-approved recipient', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([STRANGER], { state: 'unknown', service }),
    ).rejects.toBeInstanceOf(DmSendUnverifiedError);
  });

  it('still allows an approved official recipient while unknown', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([HQ], { state: 'unknown', service }),
    ).resolves.toBeUndefined();
  });
});

describe('isDmComposeBlockedForMinor', () => {
  const isApproved = (pubkey: string) => pubkey === HQ;

  it('never blocks a positively not-protected user', () => {
    expect(
      isDmComposeBlockedForMinor(STRANGER, { state: 'not_protected', isApproved }),
    ).toBe(false);
  });

  it('allows a protected minor to compose to an approved account', () => {
    expect(
      isDmComposeBlockedForMinor(HQ, { state: 'protected', isApproved }),
    ).toBe(false);
  });

  it('blocks a protected minor composing to a non-approved account', () => {
    expect(
      isDmComposeBlockedForMinor(STRANGER, { state: 'protected', isApproved }),
    ).toBe(true);
  });

  it('fails closed on unknown: blocks compose to a non-approved account', () => {
    expect(
      isDmComposeBlockedForMinor(STRANGER, { state: 'unknown', isApproved }),
    ).toBe(true);
  });

  it('keeps an approved official composable while unknown', () => {
    expect(
      isDmComposeBlockedForMinor(HQ, { state: 'unknown', isApproved }),
    ).toBe(false);
  });
});
