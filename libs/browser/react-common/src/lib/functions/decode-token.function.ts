// todo: check expiration and return undefined if expired
export function decodeToken<TToken>(token: string | undefined): TToken | undefined {
  if (!token?.length) {
      return;
  }

  const textualValue = atob(token.split('.')[1]);

  return (textualValue ? JSON.parse(textualValue) : {}) as TToken;
}