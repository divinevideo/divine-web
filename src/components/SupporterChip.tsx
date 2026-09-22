import { Heart } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

export function SupporterChip() {
  const { t } = useTranslation();
  return <Badge variant="secondary" className="gap-1"><Heart weight="fill" aria-hidden="true" className="h-3 w-3" />{t('supporters.chip')}</Badge>;
}
