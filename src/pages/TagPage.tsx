import { Navigate, useParams } from 'react-router-dom';
import { AppPage, AppPageHeader } from '@/components/AppPage';
import { Card, CardContent } from '@/components/ui/card';

export function TagPage() {
  const { tag } = useParams<{ tag: string }>();
  const normalizedTag = (tag || '').toLowerCase();

  if (!normalizedTag) {
    return (
      <AppPage width="detail">
        <AppPageHeader
          eyebrow="Legacy hashtag route"
          title="Tag not found"
          description="The requested tag could not be resolved."
        />
        <Card className="app-surface border-destructive">
          <CardContent className="py-12 text-center text-muted-foreground">
            The requested tag could not be found.
          </CardContent>
        </Card>
      </AppPage>
    );
  }

  return <Navigate to={`/hashtag/${encodeURIComponent(normalizedTag)}`} replace />;
}
