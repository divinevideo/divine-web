import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { useAgeRestrictedHideChoice } from '@/hooks/useAgeRestrictedHideChoice';

const DISCOVERED_IDS_KEY = 'discovered-age-restricted-video-ids';
const MAX_DISCOVERED_IDS = 500;
const EMPTY_SNAPSHOT = '[]';
const NEVER_HIDE = () => false;

export interface AgeRestrictedVideo {
  id: string;
  ageRestricted?: boolean;
  pubkey?: string;
  kind?: number;
  vineId?: string | null;
}

function discoveryKey(video: string | AgeRestrictedVideo): string {
  if (typeof video === 'string') return video;
  return video.pubkey && video.kind && video.vineId
    ? `${video.pubkey}:${video.kind}:${video.vineId}`
    : video.id;
}

function readDiscoveredIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISCOVERED_IDS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function markAgeRestricted(video: string | AgeRestrictedVideo): void {
  const key = discoveryKey(video);
  const latest = readDiscoveredIds();
  if (latest.includes(key)) return;
  const previous = typeof video !== 'string' && key !== video.id ? latest.filter(id => id !== video.id) : latest;
  try {
    const newValue = JSON.stringify([...previous.slice(-(MAX_DISCOVERED_IDS - 1)), key]);
    localStorage.setItem(DISCOVERED_IDS_KEY, newValue);
    window.dispatchEvent(new CustomEvent('local-storage-change', { detail: { key: DISCOVERED_IDS_KEY, newValue } }));
  } catch {
    return;
  }
}

function readDiscoverySnapshot(): string {
  try { return localStorage.getItem(DISCOVERED_IDS_KEY) ?? EMPTY_SNAPSHOT; } catch { return EMPTY_SNAPSHOT; }
}

function subscribeDiscoveries(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === DISCOVERED_IDS_KEY) onChange();
  };
  const handleLocal = (event: Event) => {
    if ((event as CustomEvent<{ key: string }>).detail?.key === DISCOVERED_IDS_KEY) onChange();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener('local-storage-change', handleLocal);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('local-storage-change', handleLocal);
  };
}

export function useAgeRestrictedPreference() {
  const { hideAgeRestricted, setHideAgeRestricted } = useAgeRestrictedHideChoice();
  const subscribe = useCallback((listener: () => void) => hideAgeRestricted ? subscribeDiscoveries(listener) : () => {}, [hideAgeRestricted]);
  const getSnapshot = useCallback(() => hideAgeRestricted ? readDiscoverySnapshot() : EMPTY_SNAPSHOT, [hideAgeRestricted]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SNAPSHOT);
  const discoveredIds = useMemo(() => {
    try {
      const value: unknown = JSON.parse(snapshot);
      return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
    } catch { return new Set<string>(); }
  }, [snapshot]);
  const shouldHideVideo = useMemo(() => hideAgeRestricted
    ? (video: AgeRestrictedVideo) => video.ageRestricted === true || discoveredIds.has(discoveryKey(video)) || discoveredIds.has(video.id)
    : NEVER_HIDE, [hideAgeRestricted, discoveredIds]);

  return { hideAgeRestricted, setHideAgeRestricted, markAgeRestricted, shouldHideVideo };
}
