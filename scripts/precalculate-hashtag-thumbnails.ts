#!/usr/bin/env tsx
// ABOUTME: Script to precalculate and cache hashtag thumbnail URLs
// ABOUTME: Uses nak CLI to query Nostr for sample videos from each hashtag and saves thumbnail URLs to JSON

import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const RELAY_URL = 'wss://relay.divine.video';
const SHORT_VIDEO_KIND = 34236;
const OUTPUT_FILE = join(process.cwd(), 'public', 'hashtag-thumbnails.json');
const HASHTAGS_FILE = join(process.cwd(), 'public', 'top_1000_hashtags.json');

interface HashtagData {
  hashtag: string;
  rank: number;
  count: number;
  percentage: number;
}

interface NostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface HashtagThumbnailCache {
  [hashtag: string]: string | null;
}

function parseVideoEvent(event: NostrEvent): string | null {
  try {
    // Try to find imeta tag with image URL (NIP-92 format)
    const imetaTag = event.tags.find(t => t[0] === 'imeta');
    if (imetaTag) {
      // imeta format: ["imeta", "url https://...", "m video/mp4", "image https://thumb.jpg"]
      for (const part of imetaTag) {
        if (typeof part === 'string' && part.startsWith('image ')) {
          const url = part.substring(6).trim();
          if (url) return url;
        }
      }
      // Fallback: get the URL from imeta as video URL
      for (const part of imetaTag) {
        if (typeof part === 'string' && part.startsWith('url ')) {
          const url = part.substring(4).trim();
          if (url) return url;
        }
      }
    }

    // Try to find image/thumb tag
    const thumbTag = event.tags.find(t => t[0] === 'thumb' || t[0] === 'image');
    if (thumbTag && thumbTag[1]) {
      return thumbTag[1];
    }

    // Try to find url tag
    const urlTag = event.tags.find(t => t[0] === 'url');
    if (urlTag && urlTag[1]) {
      return urlTag[1];
    }

    // Try to parse content as JSON for thumbnail
    if (event.content) {
      try {
        const json = JSON.parse(event.content);
        if (json.thumbnail) return json.thumbnail;
        if (json.thumb) return json.thumb;
        if (json.image) return json.image;
        if (json.url) return json.url;
      } catch {
        // Not JSON, ignore
      }
    }

    return null;
  } catch (err) {
    console.error('Error parsing video event:', err);
    return null;
  }
}

async function verifyThumbnailUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function findThumbnailForHashtag(hashtag: string): Promise<string | null> {
  try {
    console.log(`[${hashtag}] Querying for videos using nak...`);

    // Use nak to query for videos with this hashtag
    const cmd = `nak req -k ${SHORT_VIDEO_KIND} -t t=${hashtag.toLowerCase()} -l 20 ${RELAY_URL}`;
    console.log(`[${hashtag}] Running: ${cmd}`);

    const output = execSync(cmd, {
      encoding: 'utf-8',
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    // Parse JSONL output (one JSON event per line)
    const lines = output.trim().split('\n').filter(line => line.trim());
    const events: NostrEvent[] = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean) as NostrEvent[];

    console.log(`[${hashtag}] Found ${events.length} events`);

    // Try to find a thumbnail from any of the events
    // Prioritize events with more reactions (assume more popular)
    for (const event of events) {
      const thumb = parseVideoEvent(event);
      if (thumb) {
        console.log(`[${hashtag}] Testing thumbnail URL: ${thumb.substring(0, 60)}...`);
        const isValid = await verifyThumbnailUrl(thumb);
        if (isValid) {
          console.log(`[${hashtag}] ✓ Found valid thumbnail: ${thumb.substring(0, 60)}...`);
          return thumb;
        } else {
          console.log(`[${hashtag}] ✗ Thumbnail URL returned error, trying next...`);
        }
      }
    }

    console.log(`[${hashtag}] ✗ No valid thumbnail found in ${events.length} events`);
    return null;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      console.error('ERROR: nak command not found. Please install nak: https://github.com/fiatjaf/nak');
      process.exit(1);
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${hashtag}] Error:`, message);
    return null;
  }
}

async function main() {
  console.log('Starting hashtag thumbnail precalculation...\n');
  console.log(`Using relay: ${RELAY_URL}`);
  console.log('Using nak CLI tool for queries\n');

  // Load hashtags from JSON
  console.log(`Loading hashtags from: ${HASHTAGS_FILE}`);
  const hashtagsData = JSON.parse(readFileSync(HASHTAGS_FILE, 'utf-8'));
  const hashtags: HashtagData[] = hashtagsData.hashtags;
  console.log(`Loaded ${hashtags.length} hashtags\n`);

  // Load existing cache if it exists
  let cache: HashtagThumbnailCache = {};
  try {
    cache = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'));
    console.log(`Loaded existing cache with ${Object.keys(cache).length} entries\n`);
  } catch {
    console.log('No existing cache found, starting fresh\n');
  }

  // Process hashtags (limit to top N for initial run)
  const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT) : 100;
  const topHashtags = hashtags.slice(0, LIMIT);

  console.log(`Processing top ${topHashtags.length} hashtags...\n`);
  let processed = 0;
  let found = 0;

  for (const { hashtag } of topHashtags) {
    // Skip if already in cache
    if (cache[hashtag] !== undefined) {
      console.log(`[${hashtag}] Already cached, skipping`);
      processed++;
      if (cache[hashtag]) found++;
      continue;
    }

    const thumbnail = await findThumbnailForHashtag(hashtag);
    cache[hashtag] = thumbnail;

    processed++;
    if (thumbnail) found++;

    // Save progress every 10 hashtags
    if (processed % 10 === 0) {
      writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));
      console.log(`\nProgress: ${processed}/${topHashtags.length} (${found} thumbnails found)\n`);
    }

    // Small delay to avoid overwhelming the relay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final save
  writeFileSync(OUTPUT_FILE, JSON.stringify(cache, null, 2));

  console.log('\n=== COMPLETED ===');
  console.log(`Processed: ${processed} hashtags`);
  console.log(`Found: ${found} thumbnails (${Math.round(found/processed*100)}%)`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
