import type { NLoginType } from '@nostrify/react/login';

const DEFAULT_STORAGE_KEY = 'nostr:login';

type LocalNsecLogin = Extract<NLoginType, { type: 'nsec' }>;

function isNsecLogin(login: NLoginType): login is LocalNsecLogin {
  return login.type === 'nsec' && typeof login.data?.nsec === 'string';
}

export function getActiveLocalNsecLogin(logins: readonly NLoginType[]): LocalNsecLogin | null {
  return logins.find(isNsecLogin) || null;
}

export function getStoredLocalNsecLogin(storageKey = DEFAULT_STORAGE_KEY): LocalNsecLogin | null {
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as NLoginType[];
    return Array.isArray(parsed) ? getActiveLocalNsecLogin(parsed) : null;
  } catch {
    return null;
  }
}

export function buildNsecDownload(nsec: string): string {
  return [
    'Divine secret key backup',
    '',
    'Store this in a password manager or another secure offline location.',
    '',
    nsec,
    '',
  ].join('\n');
}
