import { describe, expect, it } from 'vitest';
import fixture from '../../../test-fixtures/concord/control-parity.json';
import { bytesToHex, hex32 } from './concord-core/derive';
import { foldControlState } from './concord-core/control';
import { parseEdition } from './concord-core/edition';
import type { OpenedEvent } from './concord-core/stream';

type ParityCase = typeof fixture.cases[number];
function project(c: ParityCase, prior = true, snapshots = true) {
  const floors = new Map(Object.entries(c.priorHeads).map(([id, head]) => [id, { version: BigInt(head.version), hash: hex32(head.hash) }]));
  const control = foldControlState(c.opened.map(event => parseEdition(event as unknown as OpenedEvent)), hex32(fixture.communityId), fixture.owner,
    prior && floors.size ? floors : undefined, snapshots && c.snapshotRumorIds.length ? new Set(c.snapshotRumorIds) : undefined);
  return {
    heads: Object.fromEntries([...control.heads].map(([id, head]) => [id, { version: head.version.toString(), hash: bytesToHex(head.hash) }])),
    incomplete: [...control.incomplete].sort(), banned: [...control.banned].sort(),
  };
}

describe('shared control-fold parity', () => {
  it.each(fixture.cases)('matches the bridge kernel projection for $name', c => {
    expect(project(c)).toEqual(c.expected);
  });

  it('requires both accepted-head floors and snapshot attribution to match the shared cases', () => {
    const expected = fixture.cases.map(c => c.expected);
    expect(fixture.cases.map(c => project(c, false, true))).not.toEqual(expected);
    expect(fixture.cases.map(c => project(c, true, false))).not.toEqual(expected);
  });

  it('keeps every shared prior head resolvable from its served edition set', () => {
    for (const c of fixture.cases) {
      const served = new Set(c.opened.map(event => bytesToHex(parseEdition(event as unknown as OpenedEvent).selfHash)));
      for (const floor of Object.values(c.priorHeads)) expect(served.has(floor.hash)).toBe(true);
    }
  });
});
