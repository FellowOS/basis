import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type SemaUser,
} from '@/lib/api.js';

export const SEMA_HOME_PATH = '/kbs';

type SemaSessionContextValue = {
  ready: boolean;
  user: SemaUser | null;
  isAdmin: boolean;
  homePath: string;
  refresh: () => Promise<SemaUser | null>;
  setUser: (user: SemaUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SemaSessionContext = createContext<SemaSessionContextValue | null>(null);

export function useSemaSession(): SemaSessionContextValue {
  const ctx = useContext(SemaSessionContext);
  if (!ctx) throw new Error('useSemaSession must be used under SemaSessionProvider');
  return ctx;
}

export function SemaSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SemaUser | null>(null);

  const refresh = useCallback(async () => {
    const next = await fetchSession();
    setUser(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const body = await loginRequest({ email, password });
    setUser(body.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const body = await registerRequest({
      email,
      password,
      display_name: displayName,
    });
    setUser(body.user);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      isAdmin: user?.is_admin === true,
      homePath: SEMA_HOME_PATH,
      refresh,
      setUser,
      login,
      register,
      logout,
    }),
    [ready, user, refresh, login, register, logout],
  );

  return <SemaSessionContext.Provider value={value}>{children}</SemaSessionContext.Provider>;
}
