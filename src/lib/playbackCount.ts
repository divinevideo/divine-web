interface VisiblePlaybackCountInput {
  isVineMigrated: boolean;
  loopCount?: number | null;
  viewStartCount?: number | null;
}

function positiveCount(count?: number | null): number {
  return typeof count === 'number' && Number.isFinite(count) && count > 0
    ? Math.floor(count)
    : 0;
}

export function getVisiblePlaybackCount({
  isVineMigrated,
  loopCount,
  viewStartCount,
}: VisiblePlaybackCountInput): number {
  const loops = positiveCount(loopCount);
  const views = positiveCount(viewStartCount);

  return isVineMigrated ? loops : Math.max(loops, views);
}
