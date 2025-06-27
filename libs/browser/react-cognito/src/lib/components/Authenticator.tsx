import { ReactNode, useEffect, useState } from 'react';
import { LoginForm } from './LoginForm';
import { OIDCCallback } from './OIDCCallback';
import { getCookie, TOKEN_NAMES } from '../utils/cookies';

interface AuthenticatorProps {
  children: ReactNode;
  cognitoConfig: {
    authority: string;
    client_id: string;
    redirect_uri: string;
    response_type: string;
    scope: string;
  };
}

const decodeJWT = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error decoding JWT:', e);
    return null;
  }
};

const validateToken = () => {
  const accessToken = getCookie(TOKEN_NAMES.ACCESS_TOKEN);
  if (!accessToken) {
    return false;
  }

  const decoded = decodeJWT(accessToken);
  if (!decoded || !decoded.exp) {
    return false;
  }

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp > currentTime;
};

export const Authenticator = ({ children, cognitoConfig }: AuthenticatorProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthentication = () => {
      const isValid = validateToken();
      setIsAuthenticated(isValid);
      setIsLoading(false);
    };

    checkAuthentication();
    // Check token validity every minute
    const interval = setInterval(checkAuthentication, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAuthSuccess = () => {
    setIsAuthenticated(validateToken());
    setError(null);
  };

  const handleAuthError = (errorMessage: string) => {
    setError(errorMessage);
    setIsAuthenticated(false);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setError(null);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Handle OIDC callback
  if (window.location.pathname === '/callback') {
    return (
      <OIDCCallback
        cognitoConfig={cognitoConfig}
        onSuccess={() => {
          handleAuthSuccess();
          window.location.href = '/'; // Redirect to home after successful login
        }}
        onError={handleAuthError}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-full max-w-md">
          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          <LoginForm
            cognitoConfig={cognitoConfig}
            onAuthSuccess={handleAuthSuccess}
            onLogout={handleLogout}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default Authenticator;