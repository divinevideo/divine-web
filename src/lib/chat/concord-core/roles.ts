/**
 * Concord V2 roles & permissions — CORD-04.
 *
 * Two kinds of permission, enforced two ways: READ access is key possession
 * (never a permission bit); WRITE authority is a member's rank in the
 * owner-rooted Roster. Bit positions are FROZEN wire format. `permissions`
 * rides the wire as a DECIMAL STRING (a JSON number is a float in JS and
 * silently corrupts past 2^53); a reader accepts either form, always writes
 * the string.
 */

export const Permissions = {
  MANAGE_ROLES: 1n << 0n,
  MANAGE_CHANNELS: 1n << 1n,
  MANAGE_METADATA: 1n << 2n,
  KICK: 1n << 3n,
  BAN: 1n << 4n,
  MANAGE_MESSAGES: 1n << 5n,
  CREATE_INVITE: 1n << 6n,
  // 1<<7 RETIRED (was MANAGE_INVITES).
  VIEW_AUDIT_LOG: 1n << 8n,
  MENTION_EVERYONE: 1n << 9n,
  PIN_MESSAGES: 1n << 11n,
  // Reserved: MANAGE_EMOJI=1<<10, MANAGE_EVENTS=1<<12.
} as const;

/**
 * Every currently-defined management bit — what an "Admin" role holds. There
 * is deliberately no all-powerful bit: a Role granted everything today does
 * NOT inherit a permission added tomorrow (CORD-04 §3).
 */
export const ADMIN_ALL =
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_CHANNELS |
  Permissions.MANAGE_METADATA |
  Permissions.KICK |
  Permissions.BAN |
  Permissions.MANAGE_MESSAGES |
  Permissions.CREATE_INVITE |
  Permissions.VIEW_AUDIT_LOG |
  Permissions.MENTION_EVERYONE |
  Permissions.PIN_MESSAGES;

/** Management bits (everything but the purely-social MENTION_EVERYONE). */
export const MANAGEMENT_MASK = ADMIN_ALL & ~Permissions.MENTION_EVERYONE;

/**
 * The STAFF bits (CORD-04 §3): the permissions whose authorized actions land
 * as Control Plane editions. A member holding ANY of them — plus always the
 * owner — is staff: the set that holds the `control_root` write key
 * (CORD-02 §2). KICK writes to the Guestbook and MANAGE_MESSAGES to Chat
 * planes; neither needs it. A future permission whose actions are Control
 * editions joins this mask by definition.
 */
export const STAFF_MASK =
  Permissions.MANAGE_ROLES |
  Permissions.MANAGE_CHANNELS |
  Permissions.MANAGE_METADATA |
  Permissions.BAN |
  Permissions.CREATE_INVITE |
  Permissions.PIN_MESSAGES;

/** Protocol-wide name cap: 64 bytes of UTF-8 (roles, channels, community name). */
export const NAME_MAX_BYTES = 64;
/** A member holds at most 64 Roles; a Community carries at most 100 (CORD-04 §2). */
export const MAX_ROLES_PER_MEMBER = 64;
export const MAX_ROLES_PER_COMMUNITY = 100;

export function permsContain(perms: bigint, bits: bigint): boolean {
  return (perms & bits) === bits;
}

export function isManagement(perms: bigint): boolean {
  return (perms & MANAGEMENT_MASK) !== 0n;
}

/** Human-facing labels for the assignable permission bits, in display order. */
export const PERMISSION_LABELS: Array<{ bit: bigint; label: string; hint: string }> = [
  { bit: Permissions.MANAGE_ROLES, label: "Manage roles", hint: "Create roles and assign them to members." },
  { bit: Permissions.MANAGE_CHANNELS, label: "Manage channels", hint: "Create, rename, and delete channels." },
  { bit: Permissions.MANAGE_METADATA, label: "Manage community", hint: "Edit name, description, logo, banner." },
  { bit: Permissions.KICK, label: "Kick members", hint: "Remove members (they can rejoin via invite)." },
  { bit: Permissions.BAN, label: "Ban members", hint: "Ban members and rotate keys to lock them out." },
  { bit: Permissions.MANAGE_MESSAGES, label: "Manage messages", hint: "Hide other members' messages." },
  { bit: Permissions.PIN_MESSAGES, label: "Pin messages", hint: "Pin messages so everyone sees them, including members who join later." },
  { bit: Permissions.CREATE_INVITE, label: "Create invites", hint: "Mint public invite links." },
  { bit: Permissions.MENTION_EVERYONE, label: "Mention everyone", hint: "Use @everyone." },
];

export type RoleScope = { kind: "server" } | { kind: "channel"; channelId: string };

export interface Role {
  roleId: string;
  name: string;
  /** Lower = higher authority. The owner is the implicit position 0, never a Role. */
  position: number;
  permissions: bigint;
  scope: RoleScope;
  /** Cosmetic badge tint; 0 = theme default. */
  color: number;
  /**
   * Hoist: show holders under this role's own named section in the member
   * list. An Armada extension field — written only when true, read tolerantly,
   * absent on the frozen CORD-04 baseline (a client that drops it loses only
   * the grouping, never authority).
   */
  display?: boolean;
}

/**
 * The CORD-04 §3 display order: by `position` (lower is higher authority),
 * ties broken by the lower `role_id`.
 *
 * The tiebreak is not cosmetic. Two Roles MAY share a position — they are
 * peers — and without a deterministic second key the order falls out of fold
 * insertion, which differs between clients and between reloads. Anything
 * index-based over the list (a drag, a move-up button) then acts on whichever
 * pair happened to land adjacent.
 */
export function byDisplayOrder(a: Role, b: Role): number {
  return a.position - b.position || a.roleId.localeCompare(b.roleId);
}

/** A stock server-scope Admin role: all current management bits, position 1. */
export function adminRole(roleId: string): Role {
  return { roleId, name: "Admin", position: 1, permissions: ADMIN_ALL, scope: { kind: "server" }, color: 0 };
}

/** The moderation bits a stock Moderator holds (people + message management). */
export const MODERATOR_ALL =
  Permissions.KICK | Permissions.BAN | Permissions.MANAGE_MESSAGES | Permissions.MENTION_EVERYONE;

/**
 * A stock server-scope Moderator role at position 2 — below Admin (1), so a
 * position-1 Admin strictly outranks it and may grant it (CORD-04 §3; the
 * Admin position itself is grantable only by the owner).
 */
export function moderatorRole(roleId: string): Role {
  return { roleId, name: "Moderator", position: 2, permissions: MODERATOR_ALL, scope: { kind: "server" }, color: 0 };
}

// ── Wire JSON (CORD-04 §2) ───────────────────────────────────────────────────

interface RoleWire {
  role_id: string;
  name: string;
  position: number;
  /** Decimal string on write; a bare number from an older edition is accepted. */
  permissions: string | number;
  scope: { kind: "server" } | { kind: "channel"; channel_id: string };
  color: number;
  /** Armada hoist extension — present only when true (see {@link Role.display}). */
  display?: boolean;
}

/**
 * Coerce a wire `color` to the spec's u32 (CORD-04 §2). A non-number, a
 * negative, or a value past 2^32-1 is out of range and becomes the theme
 * default rather than an arbitrary tint; an in-range float is truncated, since
 * its integer part is a colour the sender plausibly meant. Since `roleToJSON`
 * writes back whatever we parsed, this is also what stops a malformed value
 * round-tripping onto the wire unchanged.
 */
function clampColor(color: unknown): number {
  if (typeof color !== "number" || !Number.isFinite(color)) return 0;
  if (color < 0 || color > 0xffffffff) return 0;
  return Math.trunc(color);
}

export function roleToJSON(role: Role): string {
  const scope: RoleWire["scope"] =
    role.scope.kind === "channel" ? { kind: "channel", channel_id: role.scope.channelId } : { kind: "server" };
  const wire: RoleWire = {
    role_id: role.roleId,
    name: role.name,
    position: role.position,
    permissions: role.permissions.toString(), // always the string form
    scope,
    color: clampColor(role.color),
    ...(role.display === true ? { display: true } : {}),
  };
  return JSON.stringify(wire);
}

export function roleFromJSON(json: string): Role | undefined {
  try {
    const w = JSON.parse(json) as RoleWire;
    if (typeof w.role_id !== "string" || !/^[0-9a-f]{64}$/i.test(w.role_id)) return undefined;
    let permissions: bigint;
    if (typeof w.permissions === "string" && /^\d+$/.test(w.permissions)) permissions = BigInt(w.permissions);
    else if (typeof w.permissions === "number" && Number.isFinite(w.permissions)) permissions = BigInt(Math.trunc(w.permissions));
    else return undefined;
    if (typeof w.position !== "number" || !Number.isInteger(w.position) || w.position < 1) {
      // Position 0 is the owner's alone — the top is not mintable (CORD-04 §3);
      // a non-integer/negative position is malformed.
      return undefined;
    }
    const name = typeof w.name === "string" ? w.name : "";
    if (new TextEncoder().encode(name).length > NAME_MAX_BYTES) return undefined;
    const scope: RoleScope =
      w.scope?.kind === "channel" && typeof w.scope.channel_id === "string"
        ? { kind: "channel", channelId: w.scope.channel_id }
        : { kind: "server" };
    return {
      roleId: w.role_id.toLowerCase(),
      name,
      position: w.position,
      permissions,
      scope,
      color: clampColor(w.color),
      ...(w.display === true ? { display: true } : {}),
    };
  } catch {
    return undefined;
  }
}

/**
 * Wire `color` is a u32 holding packed 0xRRGGBB. 0 is "theme default", so a
 * role tinted pure black is indistinguishable from an untinted one — an
 * inherent property of the spec encoding, not something a client can fix.
 * Returns undefined for 0 so callers fall through to the theme.
 *
 * NOTE the asymmetry with serialization: `roleFromJSON`/`roleToJSON` carry the
 * full u32, so a foreign client's high byte survives a round-trip untouched.
 * These two only speak 24-bit RGB, because that is all the picker can express —
 * so EDITING such a role's colour narrows it to its low 24 bits. That is a real
 * (if cosmetic) loss, and it is confined to an explicit user edit rather than
 * happening to every role we merely read.
 */
export function colorToHex(color: number): string | undefined {
  if (!Number.isFinite(color)) return undefined;
  const rgb = Math.trunc(color) & 0xffffff;
  if (rgb === 0) return undefined;
  return `#${rgb.toString(16).padStart(6, "0")}`;
}

/** `#RRGGBB` → the packed u32 the wire wants. Unparseable input is theme default (0). */
export function hexToColor(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  return m ? parseInt(m[1], 16) : 0;
}

/**
 * Where a reorder would actually land. A reorder reuses the existing multiset
 * of `position` values, reassigned to the roles in the requested visual order,
 * rather than renumbering 1..N — renumbering would try to claim position 1,
 * which no actor ranked at 1 may write, so a legal reshuffle of the lower ranks
 * would fail for everyone but the owner.
 *
 * The cost of that reuse is that it cannot separate peers: given A(3) B(3)
 * C(5), requesting C, A, B assigns C→3 and B→5, and the §3 tie-break then
 * renders A, C, B. The request is unsatisfiable, not merely partially applied,
 * so callers must compare `rendered` against what was asked for BEFORE
 * publishing anything.
 *
 * `current` must already be sorted by {@link byDisplayOrder}; `next` is a
 * permutation of it.
 */
export function projectReorder(current: Role[], next: Role[]): { landing: Role[]; rendered: Role[] } {
  const positions = current.map((r) => r.position);
  const landing = next.map((role, i) => ({ ...role, position: positions[i] }));
  return { landing, rendered: [...landing].sort(byDisplayOrder) };
}

/**
 * The escape from a roster reuse cannot reorder. Peers are legal (§3) and a
 * roster where every Role shares one position has ZERO reachable orders under
 * {@link projectReorder} — every reassignment is the identity — while
 * `RoleEditor` offers no position control, so the roster is stuck. Such a
 * roster is reachable in practice: a reorder that failed partway leaves two
 * Roles on one position.
 *
 * This gives every Role its own `position`, in the requested display order, so
 * the tie-break stops deciding anything and the drag then applies normally.
 * Rewriting position-on-role is the spec's own mechanism ("position-on-role is
 * the frozen baseline", CORD-04 §3) — no wire change, no RoleOrder entity.
 *
 * `floor` is the lowest position the actor may claim: rank + 1, or 1 for the
 * owner (no edition may claim a position at or above its own signer, §3). Roles
 * already above the floor cannot be rewritten by this actor, so they keep their
 * position and must lead the requested order — if `next` asks to overtake one,
 * the request needs a rank the actor does not have and this returns null.
 *
 * Numbering starts at the touchable roles' current lowest position rather than
 * at `floor`, so a roster that is already spread out barely moves, and repeated
 * normalizing does not inflate positions.
 */
export function normalizeOrder(next: Role[], floor: number): Role[] | null {
  const fixed = next.filter((r) => r.position < floor);
  // Untouchable roles outrank every position the actor can write, so they must
  // already occupy the leading slots, in their own display order.
  const lead = next.slice(0, fixed.length);
  if (lead.some((r) => r.position >= floor)) return null;
  if ([...lead].sort(byDisplayOrder).some((r, i) => r.roleId !== lead[i].roleId)) return null;

  const movable = next.slice(fixed.length);
  if (movable.length === 0) return null; // nothing this actor may rewrite
  // Every movable role already sits at or below the floor in authority, so the
  // lowest of them is itself a position the actor may claim.
  const base = Math.min(...movable.map((r) => r.position));
  return [...lead, ...movable.map((role, i) => ({ ...role, position: base + i }))];
}

export interface MemberGrant {
  /** Grantee pubkey, lowercase hex. */
  member: string;
  roleIds: string[];
  /**
   * The staff write key riding the Grant (CORD-04 §3): the current
   * `control_root` NIP-44-encrypted under the granter↔member pairwise
   * conversation key, base64 — delivery, never authority. Its plaintext is
   * fixed-width, `epoch_be[8] ‖ control_root[32]`, and the recipient adopts
   * the secret only if it derives to exactly the `control_pk` they hold for
   * the named epoch. Opaque pairwise ciphertext to every other reader.
   */
  controlWrap?: string;
}

interface MemberGrantWire {
  member: string;
  role_ids: string[];
  control_wrap?: string;
}

/** Sanity bound on a carried `control_wrap` (a NIP-44 wrap of 40 bytes is ~130 chars). */
const MAX_CONTROL_WRAP_CHARS = 1024;

export function grantToJSON(grant: MemberGrant): string {
  const wire: MemberGrantWire = {
    member: grant.member,
    role_ids: grant.roleIds,
    ...(grant.controlWrap !== undefined ? { control_wrap: grant.controlWrap } : {}),
  };
  return JSON.stringify(wire);
}

export function grantFromJSON(json: string): MemberGrant | undefined {
  try {
    const w = JSON.parse(json) as MemberGrantWire;
    if (typeof w.member !== "string" || !/^[0-9a-f]{64}$/i.test(w.member)) return undefined;
    const roleIds = Array.isArray(w.role_ids)
      ? w.role_ids.filter((r): r is string => typeof r === "string").slice(0, MAX_ROLES_PER_MEMBER)
      : [];
    const controlWrap =
      typeof w.control_wrap === "string" && w.control_wrap.length > 0 && w.control_wrap.length <= MAX_CONTROL_WRAP_CHARS
        ? w.control_wrap
        : undefined;
    return {
      member: w.member.toLowerCase(),
      roleIds,
      ...(controlWrap !== undefined ? { controlWrap } : {}),
    };
  } catch {
    return undefined;
  }
}

// ── The aggregated role graph ────────────────────────────────────────────────

export interface CommunityRoles {
  roles: Role[];
  grants: MemberGrant[];
}

export function emptyRoles(): CommunityRoles {
  return { roles: [], grants: [] };
}

export function roleById(roles: CommunityRoles, roleId: string): Role | undefined {
  return roles.roles.find((r) => r.roleId === roleId);
}

export function rolesOf(roles: CommunityRoles, memberHex: string): Role[] {
  const out: Role[] = [];
  for (const g of roles.grants) {
    if (g.member !== memberHex) continue;
    for (const rid of g.roleIds) {
      const r = roleById(roles, rid);
      if (r) out.push(r);
    }
  }
  return out;
}

export function effectivePermissions(roles: CommunityRoles, memberHex: string): bigint {
  return rolesOf(roles, memberHex).reduce((acc, r) => acc | r.permissions, 0n);
}

/**
 * Effective permissions for an action TARGETING one channel: server-scope
 * Roles plus Roles scoped to that channel. The fold stays scope-agnostic
 * (every implementation folds the same union, CORD-04 §3), so this narrows
 * only what THIS client offers its user, never what it honors from others.
 */
export function effectivePermissionsIn(roles: CommunityRoles, memberHex: string, channelIdHex: string): bigint {
  return rolesOf(roles, memberHex).reduce(
    (acc, r) => (r.scope.kind === "server" || r.scope.channelId === channelIdHex ? acc | r.permissions : acc),
    0n,
  );
}

/** {@link isAuthorized}, judged against one channel per {@link effectivePermissionsIn}. */
export function isAuthorizedIn(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  channelIdHex: string,
  permission: bigint,
): boolean {
  if (ownerHex === actorHex) return true;
  return permsContain(effectivePermissionsIn(roles, actorHex, channelIdHex), permission);
}

export function hasPermission(roles: CommunityRoles, memberHex: string, bits: bigint): boolean {
  return permsContain(effectivePermissions(roles, memberHex), bits);
}

/**
 * Whether a member is STAFF (CORD-04 §3): the owner, or any holder of a
 * Control-writing bit ({@link STAFF_MASK}) — the set entitled to the
 * `control_root` (CORD-02 §2).
 */
export function isStaff(roles: CommunityRoles, memberHex: string, ownerHex: string | undefined): boolean {
  if (memberHex === ownerHex) return true;
  return (effectivePermissions(roles, memberHex) & STAFF_MASK) !== 0n;
}

/**
 * Whether a grant's role set leaves its member staff, judged against `roles`'
 * definitions — the granter-side trigger for delivering the `control_root`
 * inside the Grant itself (CORD-04 §3).
 */
export function rolesMakeStaff(roles: CommunityRoles, roleIds: string[]): boolean {
  return roleIds.some((rid) => {
    const r = roleById(roles, rid);
    return r !== undefined && (r.permissions & STAFF_MASK) !== 0n;
  });
}

/** A member's rank: the lowest position among their Roles; undefined if roleless. */
export function highestPosition(roles: CommunityRoles, memberHex: string): number | undefined {
  const positions = rolesOf(roles, memberHex).map((r) => r.position);
  return positions.length ? Math.min(...positions) : undefined;
}

export function isAdmin(roles: CommunityRoles, memberHex: string): boolean {
  return rolesOf(roles, memberHex).some((r) => isManagement(r.permissions));
}

/**
 * The member's display tier for the shared member list: "admin" if they can
 * shape the roster itself (MANAGE_ROLES), "moderator" for any other management
 * bits (kick/ban/messages/channels/…), undefined for a roleless member.
 */
export function badgeOf(roles: CommunityRoles, memberHex: string): "admin" | "moderator" | undefined {
  const perms = effectivePermissions(roles, memberHex);
  if (permsContain(perms, Permissions.MANAGE_ROLES)) return "admin";
  if (isManagement(perms)) return "moderator";
  return undefined;
}

/** Owner is supreme; otherwise the actor must hold `permission`. */
export function isAuthorized(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  permission: bigint,
): boolean {
  if (ownerHex === actorHex) return true;
  return hasPermission(roles, actorHex, permission);
}

/**
 * The position a new Role signed by `actorHex` may claim, or `undefined` when
 * they may claim none (CORD-04 §3).
 *
 * "No edition may claim a position at or above its own signer" — so the rank a
 * client mints at is a function of the signer's rank, never a constant. The
 * owner is position 0 and mints at 1 (no Role may ever claim 0 itself).
 *
 * `undefined` is the important return. A roleless member is "effectively
 * last", so every position is at or above them and there is nothing they may
 * mint; the same holds when the roster has not folded yet, because absence of
 * evidence of rank is not evidence of supremacy. Collapsing either case to
 * rank 0 mints an edition every verifier drops for self-promotion, while the
 * minting client reports success — the failure is silent on both sides.
 */
export function mintablePosition(
  roles: CommunityRoles | undefined,
  actorHex: string,
  ownerHex: string | undefined,
): number | undefined {
  // Owner supremacy comes from the community_id commitment, not the fold, so
  // it holds even before the roster loads.
  if (ownerHex === actorHex) return 1;
  if (!roles) return undefined;
  const rank = highestPosition(roles, actorHex);
  return rank === undefined ? undefined : rank + 1;
}

/**
 * The position to mint a Role that confers READ ACCESS and nothing else — the
 * BOTTOM of the hierarchy rather than {@link mintablePosition}'s top.
 *
 * `mintablePosition` answers "how high may this signer reach", which is the
 * right question for an authority Role and the wrong one for an access Role.
 * A member's rank is the LOWEST position among their Roles (CORD-04 §3) and
 * rank is independent of permission bits, so a zero-permission Role minted at
 * the signer's own ceiling PROMOTES whoever is granted it to the signer's
 * rank. Granting read access to an owner-created channel would seat a plain
 * member at position 1 — peer to every Admin, and "equal cannot act on equal"
 * then locks Admins out of moderating them AND out of granting the Role at
 * all.
 *
 * So this returns one below the lowest-ranked Role in the community (or the
 * signer's own floor, whichever is deeper). Two access Roles sharing a
 * position is fine and expected — "two Roles MAY share a position, they are
 * peers" — because peers at the bottom act on nobody. `undefined` when the
 * signer may mint none, for {@link mintablePosition}'s reasons.
 */
export function accessRolePosition(
  roles: CommunityRoles | undefined,
  actorHex: string,
  ownerHex: string | undefined,
): number | undefined {
  const ceiling = mintablePosition(roles, actorHex, ownerHex);
  if (ceiling === undefined) return undefined;
  const lowest = (roles?.roles ?? []).reduce((acc, r) => Math.max(acc, r.position), 0);
  return Math.max(ceiling, lowest + 1);
}

/** Does the actor STRICTLY outrank `targetPosition`? Owner outranks everything. */
export function outranks(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  targetPosition: number,
): boolean {
  if (ownerHex === actorHex) return true;
  const p = highestPosition(roles, actorHex);
  return p !== undefined && p < targetPosition;
}

/**
 * Why this Grant would be dropped by its verifiers, or `undefined` when it is
 * publishable (CORD-04 §2/§3): the signer must strictly outrank the member
 * they are editing AND every Role the grant hands out. The owner's grants are
 * always admitted — including one targeting the owner (a cosmetic self-grant;
 * their authority is position 0 with or without roles).
 *
 * A conforming client checks this BEFORE publishing: the fold applies the
 * same rules network-wide, so an edition that fails them is silently ignored
 * by every verifier while its author sees success.
 */
export function grantRefusal(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  memberHex: string,
  roleIds: string[],
): string | undefined {
  if (actorHex === ownerHex) return undefined;
  if (!canActOnMember(roles, actorHex, ownerHex, memberHex, Permissions.MANAGE_ROLES)) {
    return "You don't outrank this member.";
  }
  for (const id of roleIds) {
    const r = roleById(roles, id);
    if (!r) return "That role isn't in the synced roster yet.";
    if (!canActOnPosition(roles, actorHex, ownerHex, r.position, Permissions.MANAGE_ROLES)) {
      return `You don't outrank the "${r.name}" role.`;
    }
  }
  return undefined;
}

/**
 * Does `actorHex` strictly outrank the member `memberHex`? The owner outranks
 * everyone and is outranked by no one; a roleless member is effectively last
 * (CORD-04 §3), so any ranked actor outranks them.
 *
 * This is the target-side half of an authority check on its own — for the
 * places where the required permission bit is verified separately (a rekey's
 * rotation filter, CORD-06 §Authority: "the Rotator must strictly outrank
 * every removed target").
 */
export function outranksMember(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  memberHex: string,
): boolean {
  if (actorHex === ownerHex) return true;
  if (memberHex === ownerHex) return false;
  const target = highestPosition(roles, memberHex) ?? Number.MAX_SAFE_INTEGER;
  return outranks(roles, actorHex, ownerHex, target);
}

/** May `actorHex` perform an action requiring `permission` against a target at `targetPosition`? */
export function canActOnPosition(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  targetPosition: number,
  permission: bigint,
): boolean {
  if (ownerHex === actorHex) return true;
  return hasPermission(roles, actorHex, permission) && outranks(roles, actorHex, ownerHex, targetPosition);
}

/**
 * Generalized member-targeting authority (ban/kick/hide/grant): the actor must
 * hold the bit AND strictly outrank the target (equal cannot act on equal).
 * The owner is never a valid target.
 */
export function canActOnMember(
  roles: CommunityRoles,
  actorHex: string,
  ownerHex: string | undefined,
  targetHex: string,
  permission: bigint,
): boolean {
  if (ownerHex === targetHex) return false;
  const targetPosition = highestPosition(roles, targetHex) ?? Number.MAX_SAFE_INTEGER;
  return canActOnPosition(roles, actorHex, ownerHex, targetPosition, permission);
}
