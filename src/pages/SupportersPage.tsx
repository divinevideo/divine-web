import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SupporterChip } from '@/components/SupporterChip';
import { useSupporter } from '@/hooks/useSupporter';
import { useToast } from '@/hooks/useToast';

export default function SupportersPage() {
  const { t } = useTranslation();
  const supporter = useSupporter();
  const { toast } = useToast();
  const unknown = supporter.data?.status === 'unknown';
  const showPurchase = !supporter.isSignedIn || (!supporter.isError && supporter.data?.status === 'expired');
  const changeVisibility = async (haloVisible: boolean) => {
    if (!supporter.data) return;
    try {
      await supporter.updateRecognition({ ...supporter.data.recognition, haloVisible });
    } catch {
      toast({ title: t('supporters.saveError'), variant: 'destructive' });
    }
  };

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      <h1 className="text-3xl font-bold">{t('supporters.title')}</h1>
      <p className="text-muted-foreground">{t('supporters.intro')}</p>
      <Card>
        <CardHeader>
          <CardTitle>
            {supporter.isActive ? t('supporters.thankYou') : t('supporters.membership')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {supporter.isActive && supporter.data ? (
            <>
              <SupporterChip />
              <p>{t('supporters.thanksDetail')}</p>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="supporter-recognition">{t('supporters.showChip')}</Label>
                <Switch
                  id="supporter-recognition"
                  checked={supporter.data.recognition.haloVisible}
                  onCheckedChange={changeVisibility}
                  disabled={supporter.isSaving || supporter.isFetching}
                />
              </div>
              <p className="text-sm text-muted-foreground">{t('supporters.privacy')}</p>
            </>
          ) : null}
          {supporter.isError && (
            <p role="alert">{t('supporters.checkError')}</p>
          )}
          {unknown && <p role="status">{t('supporters.unknown')}</p>}
          {supporter.canCheck && (
            <>
              {!supporter.data && !supporter.isError && (
                <p>{t('supporters.checkHint')}</p>
              )}
              <Button
                className="h-auto max-w-full whitespace-normal py-2"
                variant="outline"
                disabled={supporter.isFetching || supporter.isSaving}
                onClick={() => void supporter.refetch()}
              >
                {supporter.isFetching
                  ? t('supporters.checking')
                  : t('supporters.check')}
              </Button>
            </>
          )}
          {showPurchase && (
            <>
              <p>{t('supporters.purchaseInstructions')}</p>
              <Button
                asChild
                className="h-auto max-w-full whitespace-normal py-2 text-center"
              >
                <Link to="/download">{t('supporters.getApp')}</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {showPurchase
              ? t('supporters.verificationPrerequisite')
              : t('supporters.verificationNext')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{t('supporters.verificationDetail')}</p>
          {supporter.isActive && (
            <Button asChild variant="outline" className="h-auto max-w-full whitespace-normal py-2 text-center">
              <Link to="/settings/linked-accounts">{t('supporters.linkAccounts')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
