import { Button } from '@/components/ui/button';
import { trackProductEvent } from '@/lib/analyticsClient';

interface SentimentPromptProps {
  promptId: string;
  promptType: 'post_session' | 'pmf';
  surface: string;
  onAnswered?: (score: number) => void;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function SentimentPrompt({
  promptId,
  promptType,
  surface,
  onAnswered,
}: SentimentPromptProps) {
  const answer = (score: number) => {
    void trackProductEvent('sentiment_prompt_answered', {
      surface,
      value: score,
      properties: {
        prompt_id: promptId,
        prompt_type: promptType,
      },
    });
    onAnswered?.(score);
  };

  return (
    <section className="rounded-lg border border-border bg-background p-3 shadow-sm">
      <p className="mb-2 text-sm font-medium text-foreground">How was that loop?</p>
      <div className="grid grid-cols-5 gap-2">
        {SCORES.map((score) => (
          <Button
            key={score}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => answer(score)}
            aria-label={String(score)}
          >
            {score}
          </Button>
        ))}
      </div>
    </section>
  );
}
