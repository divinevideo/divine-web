import { Button } from '@/components/ui/button';

interface WebAccountSignInFormProps {
  advancedOpen: boolean;
  isLoading: boolean;
  onContinue: () => void;
  onToggleAdvanced: () => void;
  /**
   * When false, the "Use Nostr instead" disclosure is not rendered at all —
   * #182 hides the key-import methods for protected-minor sessions.
   */
  showNostrOptions?: boolean;
}

export function WebAccountSignInForm(props: WebAccountSignInFormProps) {
  const { advancedOpen, isLoading, onContinue, onToggleAdvanced, showNostrOptions = true } = props;

  return (
    <div className="space-y-4">
      <Button className="w-full rounded-full py-3" disabled={isLoading} onClick={onContinue} type="button">
        {isLoading ? 'Redirecting...' : 'Sign in at login.divine.video'}
      </Button>

      {showNostrOptions ? (
        <Button
          className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
          onClick={onToggleAdvanced}
          type="button"
          variant="link"
        >
          {advancedOpen ? 'Hide Nostr options' : 'Use Nostr instead'}
        </Button>
      ) : null}
    </div>
  );
}

export default WebAccountSignInForm;
