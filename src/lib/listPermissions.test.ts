import { describe, expect, it } from 'vitest';
import { resolveListPermissions } from './listPermissions';

describe('resolveListPermissions', () => {
  it('grants full permissions to list owner', () => {
    const permissions = resolveListPermissions({
      ownerPubkey: 'a'.repeat(64),
      isCollaborative: true,
      allowedCollaborators: ['b'.repeat(64)],
    }, 'a'.repeat(64));

    expect(permissions.isOwner).toBe(true);
    expect(permissions.isCollaborator).toBe(false);
    expect(permissions.canEditContent).toBe(true);
    expect(permissions.canEditMetadata).toBe(true);
    expect(permissions.canDelete).toBe(true);
  });

  it('grants content edit permissions to listed collaborators', () => {
    const permissions = resolveListPermissions({
      ownerPubkey: 'a'.repeat(64),
      isCollaborative: true,
      allowedCollaborators: ['b'.repeat(64)],
    }, 'b'.repeat(64));

    expect(permissions.isOwner).toBe(false);
    expect(permissions.isCollaborator).toBe(true);
    expect(permissions.canEditContent).toBe(true);
    expect(permissions.canEditMetadata).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });

  it('keeps outsiders read-only', () => {
    const permissions = resolveListPermissions({
      ownerPubkey: 'a'.repeat(64),
      isCollaborative: true,
      allowedCollaborators: ['b'.repeat(64)],
    }, 'c'.repeat(64));

    expect(permissions.isOwner).toBe(false);
    expect(permissions.isCollaborator).toBe(false);
    expect(permissions.canEditContent).toBe(false);
    expect(permissions.canEditMetadata).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });
});
