import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { SupporterChip } from '@/components/SupporterChip';
import { useSupporter } from '@/hooks/useSupporter';
import { usePublicSupporter } from '@/hooks/usePublicSupporter';

export function OwnSupporterRecognition() {
  const { t } = useTranslation();
  const { isActive } = useSupporter();
  if (!isActive) return null;
  return <div className="space-y-1"><Link to="/supporters"><SupporterChip /></Link><p className="text-sm text-muted-foreground">{t('supporters.thankYou')}</p></div>;
}

export function PublicSupporterRecognition({ pubkey }: { pubkey: string }) {
  const { data, isError } = usePublicSupporter(pubkey);
  return data && !isError ? <SupporterChip /> : null;
}
