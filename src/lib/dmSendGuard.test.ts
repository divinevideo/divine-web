import { describe, expect, it, vi } from 'vitest';
import { assertMinorDmRecipientsAllowed, DmSendBlockedError } from './dmSendGuard';

const HQ = 'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
const STRANGER = 'de'.repeat(32);

function serviceApproving(approved: Set<string>) {
  return {
    isApprovedMinorDmRecipient: vi.fn(async (hex: string) => approved.has(hex)),
  };
}

describe('assertMinorDmRecipientsAllowed', () => {
  it('is a no-op for a non-protected user (never consults the service)', async () => {
    const service = serviceApproving(new Set());
    await assertMinorDmRecipientsAllowed([STRANGER], {
      isProtectedMinor: false,
      service,
    });
    expect(service.isApprovedMinorDmRecipient).not.toHaveBeenCalled();
  });

  it('resolves when a protected minor sends to all-approved recipients', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([HQ], { isProtectedMinor: true, service }),
    ).resolves.toBeUndefined();
  });

  it('throws DmSendBlockedError when any recipient is not approved (group all-or-nothing)', async () => {
    const service = serviceApproving(new Set([HQ]));
    await expect(
      assertMinorDmRecipientsAllowed([HQ, STRANGER], {
        isProtectedMinor: true,
        service,
      }),
    ).rejects.toBeInstanceOf(DmSendBlockedError);
  });
});
