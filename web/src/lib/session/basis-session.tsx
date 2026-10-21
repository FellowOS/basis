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
  setToken,
  type BasisUser,
} from '@/lib/session/api.js';

export const BASIS_HOME_PATH = '/workspaces';

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
    const params = new URLSearchParams(window.location.search);
    const magic = params.get('magic_link');
    if (magic) {
      const guardKey = `basis.magic_link.${magic}`;
      if (!sessionStorage.getItem(guardKey)) {
        sessionStorage.setItem(guardKey, '1');
        window.location.replace(
          `/api/v1/auth/magic-link/verify?token=${encodeURIComponent(magic)}`,
        );
      }
      return;
    }
    const oauthToken = params.get('basis_token');
    if (oauthToken) {
      setToken(oauthToken);
      params.delete('basis_token');
      const rest = params.toString();
      const next = `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', next);
    }
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
    const result = await logoutRequest();
    setUser(null);
    const sloUrl = result.saml_logout_url?.trim();
    if (sloUrl) {
      window.location.assign(sloUrl);
    }
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
