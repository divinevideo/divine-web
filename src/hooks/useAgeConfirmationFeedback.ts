import { useCallback, useState } from 'react';

export function useAgeConfirmationFeedback(confirmAdult: () => boolean, identity: string) {
  const [failure, setFailure] = useState<{ confirm: () => boolean; identity: string; target: string } | null>(null);
  const confirmFor = useCallback((target: string) => {
    const accepted = confirmAdult();
    setFailure(accepted ? null : { confirm: confirmAdult, identity, target });
    return accepted;
  }, [confirmAdult, identity]);
  const failedFor = useCallback((target: string) => !!failure && failure.confirm === confirmAdult
    && failure.identity === identity && failure.target === target, [failure, confirmAdult, identity]);
  return { confirmFor, failedFor };
}
