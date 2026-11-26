import { matchPath, parsePath } from 'react-router-dom';

const routes = [
  '/', '/discovery', '/discovery/:tab', '/trending', '/popular', '/hashtags',
  '/hashtag/:tag', '/category', '/category/:name', '/t/:tag',
  '/profile/:npub/lists', '/profile/:npub', '/u/:userId', '/video/:id', '/v/:legacyVineId',
  '/search', '/leaderboard', '/merch', '/supporters', '/services',
  '/list/:pubkey/:listId', '/people-lists/:pubkey/:listId',
  '/event/a/:kind/:pubkey/:identifier', '/event/:eventId',
  '/home', '/notifications', '/messages/:conversationId', '/messages', '/analytics', '/lists',
  '/collabs', '/collabs/:tab', '/settings/moderation', '/settings/linked-accounts', '/settings/relays', '/debug-video',
  '/chat/:communityId/:channelId/thread/:threadId', '/chat/:communityId/:channelId',
  '/chat/invite', '/chat/:communityId', '/chat', '/invite/:code',
  '/authenticity', '/privacy', '/terms', '/open-source', '/proofmode', '/human-created',
  '/dmca', '/safety', '/family', '/family/:page', '/age-review', '/kids', '/download',
  '/exit/start', '/exit', '/account-portability', '/delete-account', '/support', '/faq',
  '/get-embed', '/app/callback', '/auth/callback', '/__brand-preview', '/:nip19',
];

export function getPerformanceRoute(value: string): string {
  const pathname = value.startsWith('/')
    ? parsePath(value).pathname ?? '/'
    : new URL(value, 'https://divine.video').pathname;
  return routes.find(path => matchPath({ path, end: true }, pathname)) ?? '/:unmatched';
}

export function measuresContentReadiness(route: string): boolean {
  return ['/', '/home', '/discovery', '/discovery/:tab', '/trending', '/popular',
    '/search', '/profile/:npub', '/u/:userId', '/video/:id', '/v/:legacyVineId'].includes(route);
}
