// ABOUTME: Login form for existing Keycast users (email/password authentication)
// ABOUTME: Integrates with Keycast identity server and REST RPC API for signing

import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { loginUser } from '@/lib/keycast';
import { useLoginActions } from '@/hooks/useLoginActions';
import { useKeycastSession } from '@/hooks/useKeycastSession';
import { toast } from '@/hooks/useToast';

interface KeycastLoginFormProps {
  onSuccess: () => void;
}

export function KeycastLoginForm({ onSuccess }: KeycastLoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useLoginActions();
  const { saveSession } = useKeycastSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔐 LOGIN handleSubmit CALLED');
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Login with Keycast to get JWT and pubkey
      console.log('Step 1: Logging in with Keycast...');
      const { token, pubkey } = await loginUser(email, password);
      console.log('Login successful, pubkey:', pubkey);

      // Step 2: Save session
      console.log('Step 2: Saving session...');
      saveSession(token, email, pubkey, rememberMe);

      // Step 3: Create Keycast login (REST RPC based signing)
      console.log('Step 3: Creating Keycast login...');
      login.keycast(pubkey, token);
      console.log('✅ Keycast login created successfully');

      // Show success toast
      toast({
        title: 'Login Successful!',
        description: 'You can now post and interact with content.',
      });

      console.log('✅ Login complete!');

      // Success!
      onSuccess();
    } catch (err) {
      console.error('Keycast login failed:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed. Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <label htmlFor="keycast-email" className="text-sm font-medium">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="keycast-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            className="pl-10 rounded-lg"
            placeholder="your@email.com"
            autoComplete="email"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="keycast-password" className="text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="keycast-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className="pl-10 rounded-lg"
            placeholder="Your password"
            autoComplete="current-password"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked === true)}
          disabled={isLoading}
        />
        <label
          htmlFor="remember-me"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Remember me for 1 week
        </label>
      </div>

      <Button
        type="submit"
        className="w-full rounded-full py-3"
        disabled={isLoading || !email.trim() || !password.trim()}
      >
        {isLoading ? 'Logging in...' : 'Log In with Email'}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your Nostr keys are securely managed by Keycast
      </p>
    </form>
  );
}
