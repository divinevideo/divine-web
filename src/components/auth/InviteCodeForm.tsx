import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface InviteCodeFormProps {
  error?: string | null;
  isLoading: boolean;
  onInviteCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  value: string;
  inputClassName?: string;
}

export function InviteCodeForm(props: InviteCodeFormProps) {
  const { t } = useTranslation();
  const {
    error,
    isLoading,
    onInviteCodeChange,
    onSubmit,
    value,
    inputClassName,
  } = props;

  return (
    <form className="space-y-4" data-hs-do-not-collect="true" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="invite-code">
          {t('inviteCodeForm.label')}
        </label>
        <Input
          autoComplete="off"
          className={inputClassName}
          id="invite-code"
          onChange={(event) => onInviteCodeChange(event.target.value)}
          placeholder={t('inviteCodeForm.placeholder')}
          value={value}
        />
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </div>

      <Button className="w-full rounded-full py-3" disabled={isLoading || !value.trim()} type="submit">
        {isLoading ? t('inviteCodeForm.checking') : t('inviteCodeForm.continue')}
      </Button>
    </form>
  );
}

export default InviteCodeForm;
