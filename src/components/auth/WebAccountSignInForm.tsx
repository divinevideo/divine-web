import { FormEvent, useState } from 'react';

import { useKeycastSession } from '@/hooks/useKeycastSession';
import { loginUser } from '@/lib/keycast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WebAccountSignInFormProps {
  advancedOpen: boolean;
  onSuccess: () => void;
  onToggleAdvanced: () => void;
}

export function WebAccountSignInForm(props: WebAccountSignInFormProps) {
  const { advancedOpen, onSuccess, onToggleAdvanced } = props;
  const { saveSession } = useKeycastSession();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password.trim()) {
      setError('Please enter both username/email and password');
      return;
    }

    setIsLoading(true);

    try {
      const result = await loginUser(identifier.trim(), password);
      saveSession(result.token, identifier.trim(), false);
      onSuccess();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="signin-identifier">
          Username or email
        </label>
        <Input
          autoComplete="username"
          disabled={isLoading}
          id="signin-identifier"
          onChange={(event) => {
            setIdentifier(event.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          value={identifier}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="signin-password">
          Password
        </label>
        <Input
          autoComplete="current-password"
          disabled={isLoading}
          id="signin-password"
          onChange={(event) => {
            setPassword(event.target.value);
            setError(null);
          }}
          type="password"
          value={password}
        />
      </div>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <Button className="w-full rounded-full py-3" disabled={isLoading || !identifier.trim() || !password.trim()} type="submit">
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>

      <Button
        className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
        onClick={onToggleAdvanced}
        type="button"
        variant="link"
      >
        {advancedOpen ? 'Hide Nostr options' : 'Use Nostr instead'}
      </Button>
    </form>
  );
}

export default WebAccountSignInForm;
