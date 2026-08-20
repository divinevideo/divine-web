// ABOUTME: Presents one item of progress for archive downloads and destination mirrors
// ABOUTME: Keeps transfer status layout consistent without coupling unrelated result types

export function TransferProgress({ completed, total, label, url }: {
  completed: number;
  total: number;
  label: string;
  url: string;
}) {
  return (
    <div className="rounded-lg border border-brand-dark-green/15 p-4 dark:border-brand-green/25" aria-live="polite">
      <p className="font-semibold text-foreground">Media {completed} of {total}</p>
      <p className="text-sm text-muted-foreground">{label}: <span className="break-all">{url}</span></p>
    </div>
  );
}
