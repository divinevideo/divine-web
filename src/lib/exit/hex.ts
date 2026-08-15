// ABOUTME: Hex validation shared by the account export libraries
// ABOUTME: Keeps the 64-character key/hash check in one place

export function isHex64(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}
