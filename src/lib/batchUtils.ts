// ABOUTME: Utility functions for batching and array operations
// ABOUTME: Pure functions for deduplication and chunking arrays

/**
 * Remove duplicates from array, preserving order
 */
export function dedupeArray<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Split array into chunks of specified size
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) throw new Error('Chunk size must be positive');
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
