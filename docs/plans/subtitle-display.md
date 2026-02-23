# Subtitle / Closed Caption Display - Implementation Plan

**Status: Already Implemented (review & polish)**
**Date: 2026-02-24**

## Executive Summary

Subtitle display for the divine-web app is **already implemented** end-to-end. The current implementation covers parsing, fetching, rendering, and toggle UI in both VideoCard (feed view) and FullscreenVideoItem (fullscreen swipe view). This document captures the existing architecture, identifies gaps, and proposes polish improvements.

---

## 1. How Subtitle Data is Stored in Nostr Video Events

### Tag Format (Kind 34236 video events)

Subtitles are referenced via a `text-track` tag on the video event:

```json
["text-track", "39307:<pubkey>:subtitles:<d-tag>", "en"]
```

- **Index 0**: Tag name `"text-track"`
- **Index 1**: Addressable coordinate string pointing to a Kind 39307 subtitle event
- **Index 2**: (optional) Language code, e.g. `"en"`

The coordinate format is `<kind>:<pubkey>:<d-tag>`, where the d-tag is typically `subtitles:<vine-id>`.

### Subtitle Event (Kind 39307)

The actual subtitle content lives in a separate addressable event:

- **Kind**: 39307
- **Tags**: `["d", "subtitles:<vine-id>"]`
- **Content**: WebVTT formatted subtitle text

```
WEBVTT

1
00:00:00.500 --> 00:00:03.200
Hello world
```

### REST API Embedding

The Funnelcake REST API can embed subtitle data directly in video responses:

| Field | Description |
|-------|-------------|
| `text_track_ref` | Addressable coordinate string (same as tag value) |
| `text_track_content` | Pre-fetched WebVTT content (avoids relay round-trip) |

---

## 2. Current Implementation Status

### Already Implemented

| Component | File | Status |
|-----------|------|--------|
| VTT Parser | `src/lib/vttParser.ts` | Complete - parses WebVTT to cue array, finds active cue by time |
| VTT Parser Tests | `src/lib/vttParser.test.ts` | Complete |
| Subtitle Hook | `src/hooks/useSubtitles.ts` | Complete - 3-tier fetch (embedded > relay > none) |
| Subtitle Overlay | `src/components/SubtitleOverlay.tsx` | Complete - syncs to video timeupdate |
| VideoPlayer integration | `src/components/VideoPlayer.tsx` | Complete - accepts `subtitleCues` and `subtitlesVisible` props |
| VideoCard CC toggle | `src/components/VideoCard.tsx` | Complete - CC button overlay with Captions icon |
| Fullscreen CC toggle | `src/components/FullscreenVideoItem.tsx` | Complete - CC button in top-right toolbar |
| Event parsing | `src/lib/videoParser.ts:getTextTrackRef()` | Complete - extracts text-track tag |
| Type definitions | `src/types/video.ts` | Complete - `textTrackRef`, `textTrackContent`, `textTrackLanguage` |
| Funnelcake types | `src/types/funnelcake.ts` | Complete - `text_track_ref`, `text_track_content` |
| Funnelcake transform | `src/lib/funnelcakeTransform.ts` | Complete - maps API fields to app types |

### Data Flow

```
Video Event (Nostr/REST)
  ├── text-track tag OR text_track_ref/text_track_content from API
  │
  ├── videoParser.ts: getTextTrackRef() extracts ref + language
  ├── funnelcakeTransform.ts: maps text_track_ref/content to ParsedVideoData
  │
  ├── useSubtitles(video) hook
  │   ├── Tier 1: video.textTrackContent → parseVtt() → VttCue[]
  │   ├── Tier 2: video.textTrackRef → relay query Kind 39307 → parseVtt()
  │   └── Tier 3: empty array (no subtitles)
  │
  ├── VideoCard / FullscreenVideoItem
  │   ├── CC toggle button (Captions icon from lucide-react)
  │   ├── Auto-show when muted + has subtitles (ccOverride ?? globalMuted)
  │   └── Passes subtitleCues + subtitlesVisible to VideoPlayer
  │
  └── VideoPlayer → SubtitleOverlay
      ├── Listens to video.timeupdate
      ├── getActiveCue(cues, currentTime) → active text
      └── Renders centered text with semi-transparent background
```

### Auto-Show Behavior

Subtitles automatically show when the video is muted (which is the default state). When the user unmutes, subtitles auto-hide. The user can override this with the CC button. The override resets when mute state changes.

```typescript
const subtitlesVisible = ccOverride ?? (globalMuted && hasSubtitles);
```

---

## 3. CC Toggle Button Placement and Design

### VideoCard (Feed View)
- **Position**: Bottom-right of video, left of the mute button (`right-14`)
- **Appearance**: 40x40 rounded-full button with backdrop blur
- **Active state**: `bg-white/30` (brighter), Inactive: `bg-black/50`
- **Icon**: `Captions` from lucide-react (the standard CC icon)
- **Visibility**: Only shown when `isPlaying && !videoError && hasSubtitles`

### FullscreenVideoItem (Fullscreen Swipe View)
- **Position**: Top-right toolbar, left of the mute button (`right-16`)
- **Appearance**: 40x40 rounded-full with backdrop blur
- **Active state**: `bg-white/30`, Inactive: `bg-black/50`
- **Icon**: `Captions` from lucide-react

---

## 4. Subtitle Overlay Rendering

### Component: `SubtitleOverlay`

```
Position: absolute bottom-12, full width, centered text
Z-index: z-20 (above video, below UI controls)
Pointer events: none (click-through)
```

### Styling
- Background: `bg-black/75` semi-transparent black
- Text: white, `text-sm`, centered
- Padding: `px-3 py-1.5`
- Border radius: `rounded-md`
- Max width: 90% of container
- Line height: `leading-snug`

### Timing
- Listens to `timeupdate` events on the HTML video element
- Uses `getActiveCue()` for linear scan of cue array (efficient for short videos)
- Runs callback immediately on mount in case video is already playing

---

## 5. State Management

### Per-Video CC Override

Each VideoCard/FullscreenVideoItem maintains local `ccOverride` state:

```typescript
const [ccOverride, setCcOverride] = useState<boolean | undefined>(undefined);
const subtitlesVisible = ccOverride ?? (globalMuted && hasSubtitles);
```

- `undefined` = follow auto-behavior (show when muted)
- `true` = force subtitles on
- `false` = force subtitles off
- Resets to `undefined` when `globalMuted` changes

### Subtitle Data Caching

The `useSubtitles` hook uses React Query with:
- `staleTime: Infinity` (subtitles never change)
- `gcTime: 30 * 60 * 1000` (kept in cache 30 minutes)
- Query key includes video ID and textTrackRef

---

## 6. Identified Gaps and Polish Opportunities

### 6.1 Persistent CC Preference (Enhancement)

**Problem**: CC on/off preference resets when navigating between videos. The mobile app also has per-video state (not global persistent).

**Proposed**: Add a global CC preference to localStorage that persists across sessions.

**Files to modify**:
- `src/hooks/useSubtitles.ts` - Add a `useGlobalCCPreference()` hook or extend existing
- `src/components/VideoCard.tsx` - Use global preference as default
- `src/components/FullscreenVideoItem.tsx` - Use global preference as default

**Implementation**:
```typescript
// New: src/hooks/useCCPreference.ts
function useCCPreference() {
  const [preference, setPreference] = useState<'auto' | 'on' | 'off'>(() => {
    return (localStorage.getItem('cc-preference') as 'auto' | 'on' | 'off') || 'auto';
  });

  const toggle = () => {
    const next = preference === 'auto' ? 'on' : preference === 'on' ? 'off' : 'auto';
    setPreference(next);
    localStorage.setItem('cc-preference', next);
  };

  return { preference, toggle };
}
```

### 6.2 CC Button in Settings (Enhancement)

**Problem**: No way to set a global CC preference from settings.

**Proposed**: Add a "Subtitles" toggle in the settings/preferences area with three states: Auto (show when muted), Always On, Always Off.

### 6.3 Subtitle Language Selection (Future)

**Problem**: Currently only supports a single subtitle track per video.

**Proposed**: When multiple text-track tags exist with different languages, show a language selector in the CC button dropdown. Low priority since most videos only have one language.

### 6.4 Missing Test Coverage

**Files to create**:
- `src/hooks/useSubtitles.test.ts` - Test the 3-tier fetch logic
- `src/components/SubtitleOverlay.test.tsx` - Test rendering and time sync

### 6.5 Font Size Accessibility

**Problem**: Subtitle text uses fixed `text-sm` size which may be too small on large screens or too large on very small screens.

**Proposed**: Use responsive font sizing (`text-sm md:text-base`) and consider a subtitle size preference.

---

## 7. Mobile App Reference

The Flutter mobile app (`divine-mobile`) has a parallel implementation:

| Mobile Component | Web Equivalent |
|-----------------|----------------|
| `subtitle_overlay.dart` | `SubtitleOverlay.tsx` |
| `subtitle_providers.dart` | `useSubtitles.ts` |
| `subtitle_service.dart` | `vttParser.ts` |
| `cc_action_button.dart` | CC button in VideoCard/FullscreenVideoItem |
| `SubtitleCue` model | `VttCue` interface |
| `SubtitleVisibility` provider | `ccOverride` local state |

Key differences:
- Mobile uses Riverpod state management; web uses React hooks + local state
- Mobile has a `subtitleVisibilityProvider` map (videoId -> bool); web uses per-component state
- Mobile had Whisper on-device transcription (currently disabled due to Android build issues)
- Both use the same 3-tier subtitle fetch strategy: embedded content > relay query > none

---

## 8. Files Reference

### Existing (no changes needed for core functionality)

| File | Purpose |
|------|---------|
| `src/lib/vttParser.ts` | WebVTT parsing and active cue lookup |
| `src/lib/vttParser.test.ts` | VTT parser tests |
| `src/hooks/useSubtitles.ts` | 3-tier subtitle fetch hook |
| `src/components/SubtitleOverlay.tsx` | Time-synced subtitle text overlay |
| `src/components/VideoPlayer.tsx` | Video player with subtitle props |
| `src/components/VideoCard.tsx` | Feed card with CC toggle |
| `src/components/FullscreenVideoItem.tsx` | Fullscreen view with CC toggle |
| `src/lib/videoParser.ts` | `getTextTrackRef()` for event parsing |
| `src/lib/funnelcakeTransform.ts` | REST API to app type mapping |
| `src/types/video.ts` | `ParsedVideoData` with text track fields |
| `src/types/funnelcake.ts` | `FunnelcakeVideoStats` with text track fields |

### To Create (polish enhancements)

| File | Purpose |
|------|---------|
| `src/hooks/useCCPreference.ts` | Global CC preference with localStorage persistence |
| `src/hooks/useSubtitles.test.ts` | Hook tests |
| `src/components/SubtitleOverlay.test.tsx` | Overlay rendering tests |

### To Modify (polish enhancements)

| File | Change |
|------|--------|
| `src/components/VideoCard.tsx` | Use global CC preference |
| `src/components/FullscreenVideoItem.tsx` | Use global CC preference |
| `src/components/SubtitleOverlay.tsx` | Responsive font sizing |

---

## 9. Implementation Steps (Polish Phase)

Since core subtitle functionality is complete, remaining work is polish:

1. **Add test coverage** for `useSubtitles` hook and `SubtitleOverlay` component
2. **Create `useCCPreference` hook** for persisted global CC preference
3. **Integrate global preference** into VideoCard and FullscreenVideoItem
4. **Add responsive font sizing** to SubtitleOverlay
5. **QA pass**: Test with actual videos that have subtitles to verify end-to-end flow
6. **Accessibility audit**: Ensure CC button has proper ARIA labels (already done) and keyboard navigation works
