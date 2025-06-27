import { useEffect } from 'react';
import { CognitoUserPool } from 'amazon-cognito-identity-js';
import { setCookie, TOKEN_NAMES } from '../utils/cookies';

interface OIDCCallbackProps {
  cognitoConfig: {
    authority: string;
    client_id: string;
  };
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const OIDCCallback = ({ cognitoConfig, onSuccess, onError }: OIDCCallbackProps) => {
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (!code) {
        onError('No authorization code found in URL');
        return;
      }

      try {
        const tokenEndpoint = `https://${cognitoConfig.authority}/oauth2/token`;
        const response = await fetch(tokenEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: cognitoConfig.client_id,
            code: code,
            redirect_uri: window.location.origin + '/callback',
          }).toString(),
        });

        if (!response.ok) {
          throw new Error('Token exchange failed');
        }

        const tokens = await response.json();

        // Set cookies with appropriate expiry
        const accessTokenExpiry = new Date();
        accessTokenExpiry.setHours(accessTokenExpiry.getHours() + 1);

        const refreshTokenExpiry = new Date();
        refreshTokenExpiry.setDate(refreshTokenExpiry.getDate() + 30);

        setCookie(TOKEN_NAMES.ACCESS_TOKEN, tokens.access_token, { expires: accessTokenExpiry });
        setCookie(TOKEN_NAMES.ID_TOKEN, tokens.id_token, { expires: accessTokenExpiry });
        if (tokens.refresh_token) {
          setCookie(TOKEN_NAMES.REFRESH_TOKEN, tokens.refresh_token, { expires: refreshTokenExpiry });
        }

        onSuccess();
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Failed to exchange code for tokens');
      }
    };

    handleCallback();
  }, [cognitoConfig, onSuccess, onError]);

  return null;
};