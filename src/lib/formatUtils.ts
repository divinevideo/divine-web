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
 * Format a classic Vine summary using the original archive loop count.
 */
export function formatClassicVineViewBreakdown(_totalViews: number, originalLoops: number): string | null {
  if (originalLoops <= 0) {
    return null;
  }

  const loopLabel = originalLoops === 1 ? 'Loop' : 'Loops';
  return `${formatCount(originalLoops)} ${loopLabel}`;
}
