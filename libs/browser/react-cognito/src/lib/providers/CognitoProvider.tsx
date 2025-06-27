import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import { getCookie, setCookie, deleteCookie, TOKEN_NAMES } from '../utils/cookies';

export interface CognitoConfig {
  authority: string;
  client_id: string;
  redirect_uri: string;
  response_type: string;
  scope: string;
  userPoolId: string;
}

interface CognitoContextType {
  cognitoConfig: CognitoConfig;
  isAuthenticated: boolean;
  user: CognitoUser | null;
  logout: () => void;
  refreshSession: () => Promise<void>;
  loginWithOIDC: (identityProvider?: string) => void;
}

const CognitoContext = createContext<CognitoContextType | null>(null);

interface CognitoProviderProps {
  children: ReactNode;
  config: CognitoConfig;
}

export const CognitoProvider = ({ children, config }: CognitoProviderProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getCookie(TOKEN_NAMES.ACCESS_TOKEN));
  const [user, setUser] = useState<CognitoUser | null>(null);

  const userPoolId = config.userPoolId;
  const userPool = new CognitoUserPool({
    UserPoolId: userPoolId,
    ClientId: config.client_id,
  });

  const logout = useCallback(() => {
    // Perform Cognito logout
    if (user) {
      user.signOut();
    }

    // Clear cookies
    deleteCookie(TOKEN_NAMES.ACCESS_TOKEN);
    deleteCookie(TOKEN_NAMES.ID_TOKEN);
    deleteCookie(TOKEN_NAMES.REFRESH_TOKEN);

    // Update state
    setIsAuthenticated(false);
    setUser(null);

    // Redirect to Cognito logout endpoint to also clear SSO session
    const logoutUrl = `https://${config.authority}/logout?client_id=${config.client_id}&logout_uri=${encodeURIComponent(window.location.origin)}`;
    window.location.href = logoutUrl;
  }, [user, config]);

  const loginWithOIDC = useCallback((identityProvider?: string) => {
    const authorizationEndpoint = `https://${config.authority}/oauth2/authorize`;
    const params = new URLSearchParams({
      client_id: config.client_id,
      response_type: config.response_type,
      scope: config.scope,
      redirect_uri: config.redirect_uri,
    });

    if (identityProvider) {
      params.append('identity_provider', identityProvider);
    }

    window.location.href = `${authorizationEndpoint}?${params.toString()}`;
  }, [config]);

  const refreshSession = useCallback(async () => {
    if (!user) return;

    const refreshToken = getCookie(TOKEN_NAMES.REFRESH_TOKEN);
    if (!refreshToken) {
      logout();
      return;
    }

    try {
      const tokenEndpoint = `https://${config.authority}/oauth2/token`;
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: config.client_id,
          refresh_token: refreshToken,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const tokens = await response.json();

      const accessTokenExpiry = new Date();
      accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 1);

      setCookie(TOKEN_NAMES.ACCESS_TOKEN, tokens.access_token, { expires: accessTokenExpiry });
      setCookie(TOKEN_NAMES.ID_TOKEN, tokens.id_token, { expires: accessTokenExpiry });

      if (tokens.refresh_token) {
        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);
        setCookie(TOKEN_NAMES.REFRESH_TOKEN, tokens.refresh_token, { expires: refreshTokenExpiry });
      }

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to refresh session:', error);
      logout();
    }
  }, [user, config, logout]);

  // Auto-refresh session when token is about to expire
  useEffect(() => {
    if (!isAuthenticated) return;

    const accessToken = getCookie(TOKEN_NAMES.ACCESS_TOKEN);
    if (!accessToken) return;

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const refreshBuffer = 5 * 60 * 1000; // 5 minutes before expiration
      const timeUntilRefresh = expirationTime - Date.now() - refreshBuffer;

      if (timeUntilRefresh <= 0) {
        refreshSession();
      } else {
        const timeout = setTimeout(refreshSession, timeUntilRefresh);
        return () => clearTimeout(timeout);
      }
    } catch (error) {
      console.error('Failed to parse access token:', error);
    }
  }, [isAuthenticated, refreshSession]);

  return (
    <CognitoContext.Provider
      value={{
        cognitoConfig: config,
        isAuthenticated,
        user,
        logout,
        refreshSession,
        loginWithOIDC,
      }}
    >
      {children}
    </CognitoContext.Provider>
  );
};

export const useCognito = () => {
  const context = useContext(CognitoContext);
  if (!context) {
    throw new Error('useCognito must be used within a CognitoProvider');
  }
  return context;
};

export default CognitoProvider;