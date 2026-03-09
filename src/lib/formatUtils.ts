// ABOUTME: Utility functions for formatting numbers, durations, and counts
// ABOUTME: Provides consistent formatting across the application for social metrics

/**
 * Format view counts and social interaction counts with K/M notation
 */
export function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toString();
}

/**
 * Format video duration from seconds to HH:MM:SS or MM:SS format
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format view count with proper pluralization
 */
export function formatViewCount(count: number): string {
  const formatted = formatCount(count);
  return count === 1 ? `${formatted} view` : `${formatted} views`;
}

/**
 * Format a classic Vine breakdown so archived loops and new diVine views stay visible.
 */
export function formatClassicVineViewBreakdown(totalViews: number, originalLoops: number): string | null {
  if (originalLoops <= 0) {
    return null;
  }

  const vineLoopLabel = `${formatCount(originalLoops)} Vine ${originalLoops === 1 ? 'loop' : 'loops'}`;
  const newViews = Math.max(totalViews - originalLoops, 0);

  if (newViews <= 0) {
    return vineLoopLabel;
  }

  return `${vineLoopLabel} + ${formatCount(newViews)} new ${newViews === 1 ? 'view' : 'views'}`;
}
