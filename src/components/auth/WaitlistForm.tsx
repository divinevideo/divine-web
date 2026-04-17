import { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WaitlistFormProps {
  contact: string;
  error?: string | null;
  isLoading: boolean;
  isSuccess: boolean;
  onBack: () => void;
  onContactChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function WaitlistForm(props: WaitlistFormProps) {
  const {
    contact,
    error,
    isLoading,
    isSuccess,
    onBack,
    onContactChange,
    onSubmit,
  } = props;

  if (isSuccess) {
    return (
      <div className="space-y-4">
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          You're on the list. We'll reach out the moment invites open up.
        </p>
        <Button
          className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
          onClick={onBack}
          type="button"
          variant="link"
        >
          I have an invite code
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="waitlist-contact">
          Email
        </label>
        <Input
          autoComplete="email"
          id="waitlist-contact"
          onChange={(event) => onContactChange(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={contact}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>

      <Button className="w-full rounded-full py-3" disabled={isLoading || !contact.trim()} type="submit">
        {isLoading ? 'Adding you...' : 'Count me in'}
      </Button>

      <Button
        className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
        onClick={onBack}
        type="button"
        variant="link"
      >
        I have an invite code
      </Button>
    </form>
  );
}

export default WaitlistForm;
