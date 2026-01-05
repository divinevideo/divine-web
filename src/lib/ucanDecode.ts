// ABOUTME: Utilities for decoding UCAN tokens
// ABOUTME: Extracts email and other claims from Keycast UCAN tokens

/**
 * Decode a UCAN token and extract the email from facts
 * UCAN format: header.payload.signature (base64url encoded)
 * Keycast UCAN payload includes facts: { email, tenant_id, redirect_origin }
 */
export function decodeUcanEmail(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (second part)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Keycast stores email in facts
    if (payload.fct && typeof payload.fct === 'object') {
      return payload.fct.email || null;
    }

    return null;
  } catch {
    return null;
  }
}
