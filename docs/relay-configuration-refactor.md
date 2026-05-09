# Relay Configuration Refactor

**Date:** 2025-11-18  
**Status:** ✅ Completed  
**Commit:** 8bc85ce

## Summary

Centralized all relay URL configurations into a single source of truth (`src/config/relays.ts`), eliminating scattered hard-coded relay URLs across 7 different files.

## Problem Statement

Prior to this refactor, relay URLs were hard-coded in multiple locations:

1. **App.tsx** - Default relay + UI picker options
2. **NostrProvider.tsx** - Profile/contact routing (3 separate locations)
3. **RelaySelector.tsx** - UI fallback defaults
4. **useFollowRelationship.ts** - Default relay hint for contact lists
5. **useSearchUsers.ts** - Hard-coded search relay
6. **TestApp.tsx** - Test configuration
7. **bunkerToWindowNostr.test.ts** - Test fixtures

This created maintenance issues:
- Updating relay lists required changes in multiple files
- Inconsistent relay naming across files
- No clear documentation of why certain relays are used
- Difficult to test with different relay configurations

## Solution

### Created `src/config/relays.ts`

A centralized configuration module with:

```typescript
// Primary relay for video content
export const PRIMARY_RELAY: RelayConfig

// Relay optimized for user search (NIP-50)
export const SEARCH_RELAY: RelayConfig

// Relays for profile metadata and contact lists
export const PROFILE_RELAYS: RelayConfig[]

// Relays available in UI picker
export const PRESET_RELAYS: RelayConfig[]

// Helper functions
export const getRelayUrls(relays: RelayConfig[]): string[]
export const toLegacyFormat(relays: RelayConfig[]): { url: string; name: string }[]
export const getRelayByUrl(url: string): RelayConfig | undefined
```

### Updated Files

| File | Change |
|------|--------|
| `App.tsx` | Use `PRIMARY_RELAY.url` and `toLegacyFormat(PRESET_RELAYS)` |
| `NostrProvider.tsx` | Use `getRelayUrls(PROFILE_RELAYS)` for profile routing |
| `RelaySelector.tsx` | Use `toLegacyFormat(PRESET_RELAYS)` as fallback |
| `useFollowRelationship.ts` | Use `PRIMARY_RELAY.url` for default relay hint |
| `useSearchUsers.ts` | Use `SEARCH_RELAY.url` for NIP-50 search |
| `TestApp.tsx` | Use `PRIMARY_RELAY.url` for test config |

## Benefits

### ✅ Maintainability
- **Single source of truth** - Update relays in one place
- **Self-documenting** - Purpose and capabilities clearly defined
- **Type-safe** - TypeScript ensures correct usage

### ✅ Consistency
- **No duplicates** - Relay URLs appear exactly once
- **Standardized naming** - Consistent relay names across app
- **Clear categorization** - Relays grouped by purpose

### ✅ Flexibility
- **Environment-aware** (future) - Easy to add dev/staging/prod configs
- **Testing** - Simple to mock relays in tests
- **User configuration** (future) - Foundation for custom relay lists

## Current Relay Configuration

### Primary Relay
- **wss://relay.divine.video** - Main video content relay with NIP-50 support

### Profile Relays (High Availability)
Used for kind 0 (profile) and kind 3 (contact lists):
- wss://relay.divine.video
- wss://purplepag.es
- wss://relay.damus.io
- wss://relay.ditto.pub
- wss://relay.primal.net

### Search Relay
- **wss://relay.divine.video** - NIP-50 search via Divine infrastructure

### NIP-05 Search Relays
Fanned out in parallel when resolving a subdomain's NIP-05:
- wss://relay.primal.net
- wss://relay.damus.io
- wss://purplepag.es

### UI Preset Relays
Available in relay picker:
- wss://relay.divine.video (Divine)
- wss://divine.diy (divine.diy)
- wss://relay.ditto.pub (Ditto)
- wss://relay.damus.io (Damus)
- wss://relay.primal.net (Primal)

## Verification

✅ TypeScript compilation: No errors  
✅ Build successful: All files generated  
✅ Behavior preserved: No functional changes  
✅ Tests pass: No breaking changes

## Future Enhancements

### Environment-Based Configuration
```typescript
export const getRelays = () => {
  if (import.meta.env.VITE_ENV === 'development') {
    return DEV_RELAYS;
  }
  return PRODUCTION_RELAYS;
};
```

### Relay Health Monitoring
```typescript
interface RelayConfig {
  url: string;
  name: string;
  healthCheck?: () => Promise<boolean>;
  lastChecked?: Date;
  status?: 'online' | 'offline' | 'slow';
}
```

### User-Configurable Relays
Allow users to add/remove/reorder relays in settings UI.

### Relay Capabilities Detection
Automatically detect NIP-50, NIP-96, Blossom support via NIP-11.

## Migration Notes

No migration needed for existing users. All relay configurations maintain the same URLs and behavior as before this refactor.

## Related Issues

Addresses maintainability issue #14 from codebase audit: "Hard-Coded Relay URLs in Multiple Places"
