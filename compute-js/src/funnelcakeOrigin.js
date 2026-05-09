const PRODUCTION_TARGET = {
  apiHost: 'api.divine.video',
  origin: 'https://relay.divine.video',
  hostHeader: 'relay.divine.video',
  backend: 'funnelcake',
};

const STAGING_TARGET = {
  apiHost: 'api.staging.divine.video',
  origin: 'https://relay.staging.divine.video',
  hostHeader: 'relay.staging.divine.video',
  backend: 'funnelcake_staging',
};

const TARGETS_BY_HOST = new Map([
  ['api.divine.video', PRODUCTION_TARGET],
  ['divine.video', PRODUCTION_TARGET],
  ['www.divine.video', PRODUCTION_TARGET],
  ['dvine.video', PRODUCTION_TARGET],
  ['api.staging.divine.video', STAGING_TARGET],
  ['staging.divine.video', STAGING_TARGET],
]);

export function getFunnelcakeOriginForApiHost(host = '') {
  return TARGETS_BY_HOST.get(host) ?? PRODUCTION_TARGET;
}

export function buildFunnelcakeUrl(target, path) {
  return new URL(path, target.origin).toString();
}
