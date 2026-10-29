import { useLocalStorage } from '@/hooks/useLocalStorage';

export function useAgeRestrictedHideChoice() {
  const [hideAgeRestricted, setHideAgeRestricted] = useLocalStorage('hide-age-restricted-videos', false);
  return { hideAgeRestricted, setHideAgeRestricted };
}
