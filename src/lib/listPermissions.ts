export interface ListPermissionInput {
  ownerPubkey?: string | null;
  isCollaborative?: boolean;
  allowedCollaborators?: Array<string | null | undefined>;
}

export interface ListPermissions {
  isOwner: boolean;
  isCollaborator: boolean;
  canEditContent: boolean;
  canEditMetadata: boolean;
  canDelete: boolean;
}

function normalizePubkey(pubkey?: string | null): string | null {
  if (!pubkey) return null;
  const normalized = pubkey.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function resolveListPermissions(
  input: ListPermissionInput,
  currentUserPubkey?: string | null,
): ListPermissions {
  const ownerPubkey = normalizePubkey(input.ownerPubkey);
  const viewerPubkey = normalizePubkey(currentUserPubkey);

  const collaboratorSet = new Set(
    (input.allowedCollaborators ?? [])
      .map((pubkey) => normalizePubkey(pubkey))
      .filter((pubkey): pubkey is string => pubkey !== null),
  );

  const isOwner = !!ownerPubkey && !!viewerPubkey && ownerPubkey === viewerPubkey;
  const isCollaborator = !!viewerPubkey && !!input.isCollaborative && collaboratorSet.has(viewerPubkey);
  const canEditContent = isOwner || isCollaborator;

  return {
    isOwner,
    isCollaborator,
    canEditContent,
    canEditMetadata: isOwner,
    canDelete: isOwner,
  };
}
