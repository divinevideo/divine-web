export function clampProductAnalyticsInteger(
  value: number,
  minimum: number,
  maximum: number,
): number {
  const integer = Number.isFinite(value) ? Math.round(value) : minimum;
  return Math.min(maximum, Math.max(minimum, integer));
}
