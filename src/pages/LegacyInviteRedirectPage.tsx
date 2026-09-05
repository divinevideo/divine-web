import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LegacyInviteRedirectPageProps {
  isLoggedIn: boolean;
}

export function LegacyInviteRedirectPage({ isLoggedIn }: LegacyInviteRedirectPageProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoggedIn) {
      sessionStorage.setItem('openSignup', '1');
    }

    navigate(isLoggedIn ? '/home' : '/', { replace: true });
  }, [isLoggedIn, navigate]);

  return null;
}
