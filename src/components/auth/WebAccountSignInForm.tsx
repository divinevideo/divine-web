import { Button } from '@/components/ui/button';

interface WebAccountSignInFormProps {
  advancedOpen: boolean;
  isLoading: boolean;
  onContinue: () => void;
  onToggleAdvanced: () => void;
}

export function WebAccountSignInForm(props: WebAccountSignInFormProps) {
  const { advancedOpen, isLoading, onContinue, onToggleAdvanced } = props;

  return (
    <div className="space-y-4">
      <Button className="w-full rounded-full py-3" disabled={isLoading} onClick={onContinue} type="button">
        {isLoading ? 'Redirecting...' : 'Continue to sign in'}
      </Button>

      <Button
        className="h-auto px-0 py-0 text-sm font-medium text-muted-foreground"
        onClick={onToggleAdvanced}
        type="button"
        variant="link"
      >
        {advancedOpen ? 'Hide Nostr options' : 'Use Nostr instead'}
      </Button>
    </div>
  );
}

export default WebAccountSignInForm;
