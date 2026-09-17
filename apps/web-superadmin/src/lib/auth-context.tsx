import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, configureApiClient } from './api-client';
import { decodeJwt, isExpired, type JwtPayload } from './jwt';
import type { Capability } from './capabilities';

const ACCESS_TOKEN_KEY = 'sa_access_token';
const REFRESH_TOKEN_KEY = 'sa_refresh_token';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type LoginResult =
  | { kind: 'mfa_required'; challengeToken: string }
  | { kind: 'authenticated' };

export type MfaVerifyResult =
  | { kind: 'authenticated' }
  | { kind: 'mfa_enrollment'; provisioningUri: string };

interface AuthContextValue {
  user: JwtPayload | null;
  isBootstrapping: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  verifyMfa(challengeToken: string, code: string): Promise<void>;
  acceptInvitation(token: string, password: string): Promise<MfaVerifyResult>;
  logout(): Promise<void>;
  hasCapability(capability: Capability): boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredTokens(): TokenPair | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

function storeTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

function clearStoredTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  // Ref porque el interceptor 401 del api-client (configurado una sola vez)
  // necesita leer siempre el token MAS RECIENTE, no el que tenia el closure
  // en el momento del configureApiClient inicial.
  const accessTokenRef = useRef<string | null>(null);

  const applyTokens = useCallback((tokens: TokenPair) => {
    storeTokens(tokens);
    accessTokenRef.current = tokens.accessToken;
    setUser(decodeJwt(tokens.accessToken));
  }, []);

  const clearSession = useCallback(() => {
    clearStoredTokens();
    accessTokenRef.current = null;
    setUser(null);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    const stored = readStoredTokens();
    if (!stored) return null;
    try {
      const tokens = await api.post<TokenPair>(
        '/auth/refresh',
        { refreshToken: stored.refreshToken },
        { skipAuth: true },
      );
      applyTokens(tokens);
      return tokens.accessToken;
    } catch {
      clearSession();
      return null;
    }
  }, [applyTokens, clearSession]);

  useEffect(() => {
    configureApiClient({
      getAccessToken: () => accessTokenRef.current,
      onUnauthorized: refresh,
    });
  }, [refresh]);

  useEffect(() => {
    const stored = readStoredTokens();
    if (!stored) {
      setIsBootstrapping(false);
      return;
    }
    const payload = decodeJwt(stored.accessToken);
    if (payload && !isExpired(payload)) {
      accessTokenRef.current = stored.accessToken;
      setUser(payload);
      setIsBootstrapping(false);
      return;
    }
    // Access token vencido o ilegible: intenta refrescar antes de decidir
    // que la sesion no es valida.
    void refresh().finally(() => setIsBootstrapping(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await api.post<
        | { mfaRequired: true; challengeToken: string }
        | (TokenPair & { expiresIn: number })
      >('/auth/login', { email, password }, { skipAuth: true });

      if ('mfaRequired' in res && res.mfaRequired) {
        return { kind: 'mfa_required', challengeToken: res.challengeToken };
      }
      applyTokens(res as TokenPair);
      return { kind: 'authenticated' };
    },
    [applyTokens],
  );

  const verifyMfa = useCallback(
    async (challengeToken: string, code: string): Promise<void> => {
      const tokens = await api.post<TokenPair>(
        '/auth/mfa/verify',
        { challengeToken, code },
        { skipAuth: true },
      );
      applyTokens(tokens);
    },
    [applyTokens],
  );

  const acceptInvitation = useCallback(
    async (token: string, password: string): Promise<MfaVerifyResult> => {
      const res = await api.post<
        | { mfaSetupRequired: true; provisioningUri: string; challengeToken: string }
        | (TokenPair & { expiresIn: number })
      >(`/users/invitations/${token}/accept`, { password }, { skipAuth: true });

      if ('mfaSetupRequired' in res && res.mfaSetupRequired) {
        // El challengeToken de enrolamiento se resuelve con el mismo
        // verifyMfa() de login: el backend trata ambos tipos de challenge
        // igual una vez que llega el codigo TOTP correcto.
        sessionStorage.setItem('sa_enrollment_challenge', res.challengeToken);
        return { kind: 'mfa_enrollment', provisioningUri: res.provisioningUri };
      }
      applyTokens(res as TokenPair);
      return { kind: 'authenticated' };
    },
    [applyTokens],
  );

  const logout = useCallback(async (): Promise<void> => {
    const stored = readStoredTokens();
    if (stored) {
      try {
        await api.post('/auth/logout', { refreshToken: stored.refreshToken });
      } catch {
        // Best-effort: si ya esta vencido o la red falla, igual limpiamos localmente.
      }
    }
    clearSession();
  }, [clearSession]);

  const hasCapability = useCallback(
    (capability: Capability) => Boolean(user?.capabilities.includes(capability)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isBootstrapping,
      login,
      verifyMfa,
      acceptInvitation,
      logout,
      hasCapability,
    }),
    [user, isBootstrapping, login, verifyMfa, acceptInvitation, logout, hasCapability],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
