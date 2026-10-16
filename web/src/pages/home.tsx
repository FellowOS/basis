import { Navigate } from 'react-router-dom';

import { LoginScreen } from '@/components/marketing/login-screen.js';
import { useBasisSession } from '@/lib/basis-session.js';

export function HomePage() {
  const { ready, user, homePath } = useBasisSession();

  if (ready && user) return <Navigate to={homePath} replace />;

  return <LoginScreen />;
}
