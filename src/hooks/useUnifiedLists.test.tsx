import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnifiedLists } from './useUnifiedLists';
import { usePeopleLists } from './usePeopleLists';
import { useVideoLists } from './useVideoLists';

vi.mock('./usePeopleLists');
vi.mock('./useVideoLists');

type PeopleListsResult = ReturnType<typeof usePeopleLists>;
type VideoListsResult = ReturnType<typeof useVideoLists>;
const mockPeople = (v: object) =>
  vi.mocked(usePeopleLists).mockReturnValue(v as unknown as PeopleListsResult);
const mockVideo = (v: object) =>
  vi.mocked(useVideoLists).mockReturnValue(v as unknown as VideoListsResult);

describe('useUnifiedLists', () => {
  const mockPubkey = 'abc123def456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('both empty returns empty arrays with false states', () => {
    mockPeople({
      data: [],
      isLoading: false,
      isError: false,
    });
    mockVideo({
      data: [],
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useUnifiedLists(mockPubkey));

    expect(result.current).toEqual({
      people: [],
      video: [],
      isLoading: false,
      isError: false,
    });
  });

  it('both populated returns both arrays', () => {
    const peopleLists = [
      {
        id: 'people-1',
        name: 'Friends',
        pubkey: mockPubkey,
        members: ['user1', 'user2'],
        createdAt: 1000,
      },
    ];
    const videoLists = [
      {
        id: 'video-1',
        name: 'Favorites',
        pubkey: mockPubkey,
        videoCoordinates: ['34236:user1:vid1'],
        createdAt: 1000,
      },
    ];

    mockPeople({
      data: peopleLists,
      isLoading: false,
      isError: false,
    });
    mockVideo({
      data: videoLists,
      isLoading: false,
      isError: false,
    });

    const { result } = renderHook(() => useUnifiedLists(mockPubkey));

    expect(result.current.people).toEqual(peopleLists);
    expect(result.current.video).toEqual(videoLists);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('isLoading is true when either hook is loading', () => {
    mockPeople({
      data: [],
      isLoading: true,
      isError: false,
    });
    mockVideo({
      data: [],
      isLoading: false,
      isError: false,
    });

    const { result: result1 } = renderHook(() => useUnifiedLists(mockPubkey));
    expect(result1.current.isLoading).toBe(true);

    mockPeople({
      data: [],
      isLoading: false,
      isError: false,
    });
    mockVideo({
      data: [],
      isLoading: true,
      isError: false,
    });

    const { result: result2 } = renderHook(() => useUnifiedLists(mockPubkey));
    expect(result2.current.isLoading).toBe(true);
  });
});