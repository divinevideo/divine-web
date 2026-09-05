import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LegacyInviteRedirectPageProps {
  isLoggedIn: boolean;
  isSessionResolving: boolean;
}

export function LegacyInviteRedirectPage({
  isLoggedIn,
  isSessionResolving,
}: LegacyInviteRedirectPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (isSessionResolving) {
      return;
    }

    if (!isLoggedIn) {
      sessionStorage.setItem('openSignup', '1');
    }

    navigate(isLoggedIn ? '/home' : '/', { replace: true });
  }, [isLoggedIn, isSessionResolving, navigate]);

  return null;
}
