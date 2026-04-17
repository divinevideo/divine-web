import { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InviteCodeFormProps {
  error?: string | null;
  isLoading: boolean;
  onInviteCodeChange: (value: string) => void;
  onJoinWaitlist?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
  waitlistEnabled: boolean;
}

export function InviteCodeForm(props: InviteCodeFormProps) {
  const {
    error,
    isLoading,
    onInviteCodeChange,
    onJoinWaitlist,
    onSubmit,
    value,
    waitlistEnabled,
  } = props;

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="invite-code">
          Invite code
        </label>
        <Input
          autoComplete="off"
          id="invite-code"
          onChange={(event) => onInviteCodeChange(event.target.value)}
          placeholder="Paste your invite code"
          value={value}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>

      <Button className="w-full rounded-full py-3" disabled={isLoading || !value.trim()} type="submit">
        {isLoading ? 'Checking...' : 'Continue'}
      </Button>

      {waitlistEnabled ? (
        <Button
          className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
          onClick={onJoinWaitlist}
          type="button"
          variant="link"
        >
          No invite? Get on the waitlist.
        </Button>
      ) : null}
    </form>
  );
}

export default InviteCodeForm;
