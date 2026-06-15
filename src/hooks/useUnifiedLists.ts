import { usePeopleLists } from './usePeopleLists';
import { useVideoLists } from './useVideoLists';

export function useUnifiedLists(pubkey: string | undefined) {
  const people = usePeopleLists(pubkey);
  const video = useVideoLists(pubkey);

  return {
    people: people.data ?? [],
    video: video.data ?? [],
    isLoading: people.isLoading || video.isLoading,
    isError: people.isError || video.isError,
  };
}
