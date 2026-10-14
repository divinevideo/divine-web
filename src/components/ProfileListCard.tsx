// ABOUTME: Compact labeled card shared by profile people-list and video-list discovery

import { UsersThree, VideoCamera } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import type { DiscoverableList } from '@/lib/profileLists';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { Card } from '@/components/ui/card';

interface ProfileListCardProps {
  list: DiscoverableList;
}

export function ProfileListCard({ list }: ProfileListCardProps) {
  const isPeopleList = list.type === 'people';
  const TypeIcon = isPeopleList ? UsersThree : VideoCamera;
  const typeLabel = isPeopleList ? 'People list' : 'Video list';
  const itemLabel = isPeopleList
    ? `${list.itemCount} ${list.itemCount === 1 ? 'person' : 'people'}`
    : `${list.itemCount} ${list.itemCount === 1 ? 'video' : 'videos'}`;
  const imageUrl = getSafeProfileImage(list.image);

  return (
    <Link to={list.href} className="block h-full rounded-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card
        variant="brand"
        accent={isPeopleList ? 'green' : 'violet'}
        className="h-full overflow-hidden transition-transform hover:-translate-y-0.5"
      >
        <div className="flex min-h-32">
          <div className="flex w-28 shrink-0 items-center justify-center bg-brand-light-green/60 dark:bg-brand-dark-green/70">
            {imageUrl ? (
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <TypeIcon className="h-10 w-10 text-brand-dark-green dark:text-brand-green" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 p-4">
            <p className="mb-1 text-xs font-semibold text-primary">{typeLabel}</p>
            <h3 className="line-clamp-1 font-display text-lg font-extrabold text-brand-dark-green dark:text-brand-off-white">
              {list.name}
            </h3>
            {list.description && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{list.description}</p>
            )}
            <p className="mt-3 text-sm font-medium text-foreground">{itemLabel}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
