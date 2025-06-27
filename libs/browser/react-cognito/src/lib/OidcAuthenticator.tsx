import { FC, ReactNode, useEffect, useState } from 'react';
import { UserManagerProvider, useUserManager } from './UserManagerProvider';

export type TOidcAuthenticatorContentProps = { unauthenticatedRenderer: (login: () => void) => ReactNode,
  errorRenderer?: (error?: any) => ReactNode,
  signingInRenderer?: () => ReactNode,
  loadingRenderer?: () => ReactNode,
  authenticatedRenderer: (user: any) => ReactNode, setCookies: (origin: string, loadedUser: any) => Promise<any> };
export type TOidcAuthenticatorProps = TOidcAuthenticatorContentProps & { userManagerConfig: any };

export const OidcAuthenticator: FC<TOidcAuthenticatorProps> = (props) => {
  return (
    <UserManagerProvider config={props.userManagerConfig}>
      <OidcAuthenticatorContent {...props}></OidcAuthenticatorContent>
    </UserManagerProvider>
  );
};

const getStorageKey = (userManager: any) => `${userManager.settings.client_id}_requestedUrl`;

const OidcAuthenticatorContent: FC<TOidcAuthenticatorContentProps> = ({ unauthenticatedRenderer, authenticatedRenderer, signingInRenderer, setCookies, loadingRenderer, errorRenderer }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userManager = useUserManager();

  useEffect(() => {
    if (window.location.pathname === '/post-login') {
      setIsLoading(true);
      setError(null);
      userManager.signinRedirectCallback()
        .then((loadedUser: any) => setCookies(location.origin, loadedUser as any).catch((e: any) => console.warn(e)).then(() => loadedUser))
        .then((loadedUser: any) => {
          setUser(loadedUser);
          setIsLoading(false);
          setError(null);

          // Get stored redirect URL with client_id prefix
          const redirectUrl = sessionStorage.getItem(getStorageKey(userManager));
          sessionStorage.removeItem(getStorageKey(userManager));
          // Redirect to stored URL or default to home
          window.location.replace(redirectUrl || '/');
        })
        .catch((err: any) => {
          setError(err.message || 'Authentication error');
          setIsLoading(false);
        });
    }
  }, [userManager]);

  useEffect(() => {
    if (window.location.pathname !== '/post-login') {
      userManager.getUser().then((loadedUser: any) => {
        if (loadedUser) {
          setUser(loadedUser);
          setCookies(location.origin, loadedUser as any).then(() => setIsLoading(false));
        } else {
          setIsLoading(false);
        }
      });
    }
  }, [userManager]);

  const login = () => {
    setError(null);
    setIsLoading(true);
    // Store current URL before redirecting to login, using client_id prefix
    if (window.location.pathname !== '/') {
      sessionStorage.setItem(getStorageKey(userManager), window.location.pathname + window.location.search);
    }
    userManager?.signinRedirect();
  };

  if (window.location.pathname === '/post-login') {
    return error ? (
      errorRenderer ? errorRenderer(error) : <div>Error: {error}</div>
    ) : (
      signingInRenderer ? signingInRenderer() :  <>{loadingRenderer ? loadingRenderer() : <div>Signing in...</div>}</>
    );
  }

  if (isLoading) {
    return loadingRenderer ? loadingRenderer() :  <div>Loading...</div>
  }

  if (error) {
    return <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>;
  }

  if (!user) {
    return unauthenticatedRenderer(login);
  }

  return authenticatedRenderer(user);
};
