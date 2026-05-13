// ABOUTME: Funnelcake video event → OG-friendly metadata transformer
// ABOUTME: Pure transform + a thin Fastly-aware fetch wrapper

import { cleanText, truncateText } from './ogTags.js';

export function parseImetaTag(tag) {
  if (!Array.isArray(tag) || tag[0] !== 'imeta') return {};
  const out = {};
  for (let i = 1; i < tag.length; i++) {
    const entry = tag[i];
    if (typeof entry !== 'string') continue;
    const space = entry.indexOf(' ');
    if (space === -1) continue;
    const key = entry.slice(0, space);
    const value = entry.slice(space + 1);
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function parseDim(dim) {
  if (typeof dim !== 'string') return [null, null];
  const m = dim.match(/^(\d+)x(\d+)$/i);
  if (!m) return [null, null];
  return [Number(m[1]), Number(m[2])];
}

export function transformVideoApiResponse(result, { defaultOgImage = null } = {}) {
  if (!result?.event) return null;
  const event = result.event;
  const stats = result.stats || {};
  const getTag = (name) => event.tags?.find((t) => t[0] === name)?.[1];

  const imetaTag = event.tags?.find((t) => t[0] === 'imeta');
  const imeta = parseImetaTag(imetaTag);

  const [videoWidth, videoHeight] = parseDim(imeta.dim);
  const [imageW, imageH] = imeta['image-dim']
    ? parseDim(imeta['image-dim'])
    : parseDim(imeta.dim);

  const summary = cleanText(getTag('summary'));
  const alt = cleanText(getTag('alt'));
  const content = cleanText(event.content);
  const title = cleanText(getTag('title')) || alt || summary || truncateText(content, 80) || null;

  const statsList = [];
  if (stats.reactions > 0) statsList.push(`${stats.reactions} ❤️`);
  if (stats.comments > 0) statsList.push(`${stats.comments} 💬`);
  if (stats.reposts > 0) statsList.push(`${stats.reposts} 🔁`);

  let description;
  if (content) description = content;
  else if (summary) description = summary;
  else if (alt) description = alt;
  else if (statsList.length > 0) description = `${statsList.join(' • ')} on Divine`;
  else description = 'Watch this short video on Divine';

  return {
    title: title || 'Video on Divine',
    description,
    thumbnail: imeta.image || defaultOgImage,
    authorName: cleanText(getTag('author')) || cleanText(stats.author_name) || '',
    reactions: stats.reactions || 0,
    comments: stats.comments || 0,
    videoUrl: imeta.url || null,
    videoMime: imeta.m || null,
    videoWidth: videoWidth || null,
    videoHeight: videoHeight || null,
    imageWidth: imageW || null,
    imageHeight: imageH || null,
  };
}
