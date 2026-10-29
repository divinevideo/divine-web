import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAgeRestrictedPreference } from '@/hooks/useAgeRestrictedPreference';

export function AgeRestrictedPreferenceCard() {
  const { t } = useTranslation();
  const { hideAgeRestricted, setHideAgeRestricted } = useAgeRestrictedPreference();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('moderationSettings.ageRestrictedPreferenceTitle')}</CardTitle>
        <CardDescription>{t('moderationSettings.ageRestrictedPreferenceDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" onClick={() => setHideAgeRestricted(!hideAgeRestricted)}>
          {hideAgeRestricted
            ? t('moderationSettings.showAgeRestrictedVideos')
            : t('moderationSettings.hideAgeRestrictedVideos')}
        </Button>
      </CardContent>
    </Card>
  );
}
