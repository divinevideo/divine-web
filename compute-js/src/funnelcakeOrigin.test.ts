import { describe, expect, it } from 'vitest';

import { getFunnelcakeOriginForApiHost } from './funnelcakeOrigin.js';

describe('getFunnelcakeOriginForApiHost', () => {
  it('maps the production API host to the production relay origin', () => {
    expect(getFunnelcakeOriginForApiHost('api.divine.video')).toEqual({
      apiHost: 'api.divine.video',
      origin: 'https://relay.divine.video',
      hostHeader: 'relay.divine.video',
      backend: 'funnelcake',
    });
  });

  it('maps the staging API host to the staging relay origin', () => {
    expect(getFunnelcakeOriginForApiHost('api.staging.divine.video')).toEqual({
      apiHost: 'api.staging.divine.video',
      origin: 'https://relay.staging.divine.video',
      hostHeader: 'relay.staging.divine.video',
      backend: 'funnelcake_staging',
    });
  });

  it('falls back to the production relay for unknown hosts', () => {
    expect(getFunnelcakeOriginForApiHost('example.com')).toEqual({
      apiHost: 'api.divine.video',
      origin: 'https://relay.divine.video',
      hostHeader: 'relay.divine.video',
      backend: 'funnelcake',
    });
  });
});
