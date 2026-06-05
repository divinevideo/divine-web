// ABOUTME: Stub for fastly:kv-store virtual module used in vitest.
// ABOUTME: Tests that need KVStore behaviour must call vi.mock('fastly:kv-store', ...) themselves.

export class KVStore {
  constructor(_name) {}
  async get(_key) { return null; }
}
