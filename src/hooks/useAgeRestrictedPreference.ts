import { useCallback } from 'react';

import { useLocalStorage } from '@/hooks/useLocalStorage';

const HIDE_KEY = 'hide-age-restricted-videos';
const DISCOVERED_IDS_KEY = 'discovered-age-restricted-video-ids';
const MAX_DISCOVERED_IDS = 500;
const EMPTY_DISCOVERED_IDS: string[] = [];

interface AgeRestrictedVideo {
  id: string;
  ageRestricted?: boolean;
}

function readDiscoveredIds(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DISCOVERED_IDS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function useAgeRestrictedPreference() {
  const [hideAgeRestricted, setHideAgeRestricted] = useLocalStorage(HIDE_KEY, false);
  const [discoveredIds, setDiscoveredIds] = useLocalStorage<string[]>(DISCOVERED_IDS_KEY, EMPTY_DISCOVERED_IDS);

  const markAgeRestricted = useCallback((videoId: string) => {
    const latest = readDiscoveredIds();
    if (latest.includes(videoId)) return;
    setDiscoveredIds([...latest.slice(-(MAX_DISCOVERED_IDS - 1)), videoId]);
  }, [setDiscoveredIds]);

  const shouldHideVideo = useCallback((video: AgeRestrictedVideo) =>
    hideAgeRestricted && (video.ageRestricted === true || (Array.isArray(discoveredIds) && discoveredIds.includes(video.id))),
  [hideAgeRestricted, discoveredIds]);

  return { hideAgeRestricted, setHideAgeRestricted, markAgeRestricted, shouldHideVideo };
}
