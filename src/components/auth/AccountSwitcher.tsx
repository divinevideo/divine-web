// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { CaretDown as ChevronDown, SignOut as LogOut, User as UserIcon, UserPlus, User, Gear as Settings, LinkSimple as Link2 } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar.tsx';
// import { WalletModal } from '@/components/WalletModal';
import { useNostrLogin } from '@nostrify/react/login';
import { useLoggedInAccounts, type Account } from '@/hooks/useLoggedInAccounts';
import { useDivineSession } from '@/hooks/useDivineSession';
import { clearLoginCookie } from '@/lib/crossSubdomainAuth';
import { genUserName } from '@/lib/genUserName';
import { getSafeProfileImage } from '@/lib/imageUtils';
import { getActiveLocalNsecLogin } from '@/lib/localNsecAccount';
import { RelaySelector } from '@/components/RelaySelector';
import { LocalNsecBanner } from './LocalNsecBanner';

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { logins } = useNostrLogin();
  const { currentUser, otherUsers, setLogin, removeLogin } = useLoggedInAccounts();
  const { clearSession } = useDivineSession();
  const navigate = useNavigate();
  const localNsecLogin = getActiveLocalNsecLogin(logins);

  if (!currentUser) return null;

  const isJwtCurrentUser = currentUser.id.startsWith('jwt:');

  const getDisplayName = (account: Account): string => {
    return account.metadata.name ?? genUserName(account.pubkey);
  }

  const handleMyProfileClick = () => {
    const npub = nip19.npubEncode(currentUser.pubkey);
    navigate(`/profile/${npub}`);
  };

  const handleLogout = () => {
    if (isJwtCurrentUser) {
      clearSession();
      clearLoginCookie();
      return;
    }

    removeLogin(currentUser.id);
  };

  return (
    <div className='account-switcher w-full min-w-0 max-w-full space-y-3'>
      {localNsecLogin ? <LocalNsecBanner nsec={localNsecLogin.data.nsec} /> : null}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button className='flex w-full min-w-0 items-center gap-3 rounded-full p-3 text-foreground transition-all hover:bg-accent'>
            <Avatar size="md">
              <AvatarImage src={getSafeProfileImage(currentUser.metadata.picture)} alt={getDisplayName(currentUser)} />
              <AvatarFallback>{getDisplayName(currentUser).charAt(0)}</AvatarFallback>
            </Avatar>
            <div className='hidden min-w-0 flex-1 truncate text-left md:block'>
              <p className='font-medium text-sm truncate'>{getDisplayName(currentUser)}</p>
            </div>
            <ChevronDown className='w-4 h-4 text-muted-foreground' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56 p-2 animate-scale-in' onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuItem
            onClick={handleMyProfileClick}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
          >
            <User className='w-4 h-4' />
            <span>My Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate('/settings/moderation')}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
          >
            <Settings className='w-4 h-4' />
            <span>Settings</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => navigate('/settings/linked-accounts')}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
          >
            <Link2 className='w-4 h-4' />
            <span>Linked Accounts</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Switch Relay</DropdownMenuLabel>
          <DropdownMenuItem onSelect={(e) => e.preventDefault()} className='p-2'>
            <RelaySelector className='w-full' />
          </DropdownMenuItem>
          {!isJwtCurrentUser ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Switch Account</DropdownMenuLabel>
              {otherUsers.map((user) => (
                <DropdownMenuItem
                  key={user.id}
                  onClick={() => setLogin(user.id)}
                  className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
                >
                  <Avatar size="sm">
                    <AvatarImage src={getSafeProfileImage(user.metadata.picture)} alt={getDisplayName(user)} />
                    <AvatarFallback>{getDisplayName(user)?.charAt(0) || <UserIcon />}</AvatarFallback>
                  </Avatar>
                  <div className='flex-1 truncate'>
                    <p className='text-sm font-medium'>{getDisplayName(user)}</p>
                  </div>
                  {user.id === currentUser.id && <div className='w-2 h-2 rounded-full bg-primary'></div>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {/* Wallet Settings temporarily hidden */}
          {/* <WalletModal>
            <DropdownMenuItem
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
              onSelect={(e) => e.preventDefault()}
            >
              <Wallet className='w-4 h-4' />
              <span>Wallet Settings</span>
            </DropdownMenuItem>
          </WalletModal> */}
          {!isJwtCurrentUser ? (
            <DropdownMenuItem
              onClick={onAddAccountClick}
              className='flex items-center gap-2 cursor-pointer p-2 rounded-md'
            >
              <UserPlus className='w-4 h-4' />
              <span>Add another account</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onClick={handleLogout}
            className='flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500'
          >
            <LogOut className='w-4 h-4' />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
