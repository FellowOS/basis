import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { devMessage } from '@/i18n/dev-messages.js';
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type BasisUser,
} from '@/lib/api.js';

export const BASIS_HOME_PATH = '/kbs';

type BasisSessionContextValue = {
  ready: boolean;
  user: BasisUser | null;
  isAdmin: boolean;
  homePath: string;
  refresh: () => Promise<BasisUser | null>;
  setUser: (user: BasisUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const BasisSessionContext = createContext<BasisSessionContextValue | null>(null);

export function useBasisSession(): BasisSessionContextValue {
  const ctx = useContext(BasisSessionContext);
  if (!ctx) throw new Error(devMessage('useBasisSession'));
  return ctx;
}

export function BasisSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<BasisUser | null>(null);

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
      homePath: BASIS_HOME_PATH,
      refresh,
      setUser,
      login,
      register,
      logout,
    }),
    [ready, user, refresh, login, register, logout],
  );

  return <BasisSessionContext.Provider value={value}>{children}</BasisSessionContext.Provider>;
}
