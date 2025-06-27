interface CookieOptions {
  domain?: string;
  path?: string;
  expires?: Date;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export const setCookie = (
  name: string,
  value: string,
  options: CookieOptions = {}
): void => {
  const domain = options.domain || getDomain();
  const path = options.path || '/';
  const secure = options.secure ?? true;
  const sameSite = options.sameSite || 'Strict';

  let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  cookieString += `; domain=${domain}`;
  cookieString += `; path=${path}`;

  if (options.expires) {
    cookieString += `; expires=${options.expires.toUTCString()}`;
  }

  if (secure) {
    cookieString += '; secure';
  }

  cookieString += `; samesite=${sameSite}`;

  document.cookie = cookieString;
};

export const getCookie = (name: string): string | null => {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.split('=').map(c => c.trim());
    if (cookieName === encodeURIComponent(name)) {
      return decodeURIComponent(cookieValue);
    }
  }
  return null;
};

export const deleteCookie = (name: string): void => {
  const domain = getDomain();
  document.cookie = `${encodeURIComponent(name)}=; domain=${domain}; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=Strict`;
};

// Helper function to get the current domain
function getDomain(): string {
  const hostname = window.location.hostname;
  // If it's localhost, just return it as is
  if (hostname === 'localhost') {
    return hostname;
  }
  // Get the top two levels of the domain (e.g., example.com from sub.example.com)
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return '.' + parts.slice(-2).join('.');
  }
  return '.' + hostname;
}

export const TOKEN_NAMES = {
  ACCESS_TOKEN: 'cognito.accessToken',
  ID_TOKEN: 'cognito.idToken',
  REFRESH_TOKEN: 'cognito.refreshToken'
} as const;