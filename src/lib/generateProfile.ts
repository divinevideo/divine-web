// ABOUTME: Generate demo profile data for users without profiles
// ABOUTME: Creates consistent, unique avatars and usernames based on pubkey

import type { NostrMetadata, NostrEvent } from '@nostrify/nostrify';

// Hash function to generate consistent values from pubkey
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Generate avatar URL - uses local default avatar
export function generateAvatar(_pubkey: string): string {
  // Use local default avatar instead of external service for privacy
  return '/user-avatar.png';
}

// Generate interesting usernames
export function generateUsername(pubkey: string): string {
  const adjectives = [
    'Electric', 'Cosmic', 'Digital', 'Neon', 'Cyber', 'Quantum', 'Stellar',
    'Lunar', 'Solar', 'Astral', 'Mystic', 'Echo', 'Nova', 'Prism', 'Zenith'
  ];

  const nouns = [
    'Vine', 'Loop', 'Wave', 'Pulse', 'Flow', 'Stream', 'Signal', 'Beacon',
    'Phoenix', 'Comet', 'Nebula', 'Vortex', 'Matrix', 'Nexus', 'Cipher'
  ];

  const hash = hashCode(pubkey);
  const adjective = adjectives[hash % adjectives.length];
  const noun = nouns[(hash >> 8) % nouns.length];
  const number = (hash % 900) + 100; // 3-digit number

  return `${adjective}${noun}${number}`;
}

// Generate bio text
export function generateBio(pubkey: string): string {
  const bios = [
    'Creating loops that inspire 🎬',
    'Sharing moments, one loop at a time',
    'Visual storyteller | Loop enthusiast',
    'Capturing life in 6-second stories',
    'Making magic with moving pictures ✨',
    'Loop creator | Visual artist',
    'Turning moments into memories',
    'Creative soul | Video loops',
    'Exploring the art of the perfect loop',
    'Visual vibes and good times 🎥'
  ];

  const hash = hashCode(pubkey);
  return bios[hash % bios.length];
}

// Generate demo metadata for a user
export function generateDemoMetadata(pubkey: string): NostrMetadata {
  const username = generateUsername(pubkey);

  return {
    name: username.toLowerCase(),
    display_name: username,
    about: generateBio(pubkey),
    picture: generateAvatar(pubkey),
    // No banner - don't make external requests for privacy
    client: 'divine.video', // Tag profiles created on divine
  };
}

// Enhanced useAuthor hook wrapper
export function enhanceAuthorData(
  data: { event?: NostrEvent; metadata?: NostrMetadata } | undefined,
  pubkey: string
): { event?: NostrEvent; metadata: NostrMetadata } {
  if (!data) {
    return {
      metadata: generateDemoMetadata(pubkey)
    };
  }

  // If we have an event but no metadata, generate demo metadata
  if (data.event && !data.metadata) {
    return {
      ...data,
      metadata: generateDemoMetadata(pubkey)
    };
  }

  // If we have partial metadata, enhance it
  if (data.metadata) {
    // Start with real data, fill in missing parts with generated data
    const enhanced: NostrMetadata = {
      ...data.metadata, // Real data first
      // Fill in missing fields with generated data
      name: data.metadata.name || generateUsername(pubkey).toLowerCase(),
      display_name: data.metadata.display_name || data.metadata.name || generateUsername(pubkey),
      about: data.metadata.about || generateBio(pubkey),
      picture: data.metadata.picture || generateAvatar(pubkey),
      // Keep banner, NIP-05 and website only if they're real (from metadata)
      banner: data.metadata.banner,
      nip05: data.metadata.nip05,
      website: data.metadata.website
    };

    return {
      ...data,
      metadata: enhanced
    };
  }

  // No data at all, return generated metadata
  return {
    metadata: generateDemoMetadata(pubkey)
  };
}