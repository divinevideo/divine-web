// ABOUTME: Canonical list of public companion Divine services shown on /services
// ABOUTME: Add future public services here; the page and prerender guard render from it

import {
  HouseLine,
  Medal,
  MusicNotes,
  Pulse,
  SealCheck,
  ShareNetwork,
  type Icon,
} from '@phosphor-icons/react';

export type DivineServiceId =
  | 'space'
  | 'sounds'
  | 'badges'
  | 'crossposter'
  | 'verifier'
  | 'status';

export interface DivineService {
  id: DivineServiceId;
  name: string;
  url: string;
  icon: Icon;
}

export const DIVINE_SERVICES: DivineService[] = [
  {
    id: 'space',
    name: 'Divine Space',
    url: 'https://divine.space',
    icon: HouseLine,
  },
  {
    id: 'sounds',
    name: 'Sounds',
    url: 'https://sounds.divine.video',
    icon: MusicNotes,
  },
  {
    id: 'badges',
    name: 'Badges',
    url: 'https://badges.divine.video',
    icon: Medal,
  },
  {
    id: 'crossposter',
    name: 'Crossposter',
    url: 'https://crossposter.divine.video',
    icon: ShareNetwork,
  },
  {
    id: 'verifier',
    name: 'Verifier',
    url: 'https://inquisitor.divine.video',
    icon: SealCheck,
  },
  {
    id: 'status',
    name: 'Status',
    url: 'https://status.divine.video',
    icon: Pulse,
  },
];
