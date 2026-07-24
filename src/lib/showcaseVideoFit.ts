// ABOUTME: Choose object-fit for a reel video so square classics aren't cropped
// ABOUTME: Portrait clips fill the tall phone frame; square/wider ones letterbox

/** Parse an imeta `dim` string ("WxH", e.g. "480x480") into a width/height ratio. */
export function parseAspectRatio(dimensions: string | undefined): number | null {
  if (!dimensions) return null;
  const match = dimensions.match(/^\s*(\d+)\s*x\s*(\d+)\s*$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  return width / height;
}

// The phone frame is a tall 9:17 (~0.53). A portrait clip (9:16 ≈ 0.56) fills it
// with only a sliver of crop, so `cover` looks best. But the classic Vine
// archive is 1:1 square (ratio 1.0) — `cover` would slice off nearly half its
// width. Anything square-or-wider is letterboxed with `contain` so the whole
// frame stays visible and the aspect ratio is preserved.
const SQUARE_OR_WIDER = 0.85;

export function pickObjectFit(aspect: number | null): 'cover' | 'contain' {
  if (aspect === null) return 'cover';
  return aspect >= SQUARE_OR_WIDER ? 'contain' : 'cover';
}
