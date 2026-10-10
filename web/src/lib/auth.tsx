import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, refreshSession, SessionResult, setAccessToken, User, whenSessionLost } from './api';

interface AuthState {
  user: User | null;
  ready: boolean;
  /** Called with the final `{status:'OK'}` result of login / MFA / e-mail verification. */
  signIn: (s: SessionResult) => void;
  signOut: () => Promise<void>;
  setUser: (u: User) => void;
}

const Ctx = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // On load, trade the httpOnly refresh cookie for a fresh access token (silent sign-in).
  useEffect(() => {
    refreshSession().then((s) => {
      if (s) setUser(s.user);
      setReady(true);
    });
    whenSessionLost(() => setUser(null));
  }, []);

  // Keep the 15-minute access token fresh while the tab is open.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => {
      refreshSession().then((s) => (s ? setUser(s.user) : setUser(null)));
    }, 12 * 60_000);
    return () => clearInterval(t);
  }, [user?.id]);

  const signIn = useCallback((s: SessionResult) => {
    setAccessToken(s.accessToken);
    setUser(s.user);
  }, []);

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, ready, signIn, signOut, setUser }), [user, ready, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const HOME: Record<User['role'], string> = {
  PATIENT: '/app/portal',
  DOCTOR: '/app/workspace',
  ADMIN: '/app/admin',
};
