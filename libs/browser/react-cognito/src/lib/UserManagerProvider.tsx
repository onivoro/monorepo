import React, { createContext, useContext, useMemo } from 'react';
import { UserManager, WebStorageStateStore, UserManagerSettings } from 'oidc-client-ts';

interface UserManagerProviderProps {
  config: UserManagerSettings;
  children: React.ReactNode;
}

const UserManagerContext = createContext<UserManager | null>(null);

export const UserManagerProvider: React.FC<UserManagerProviderProps> = ({ config, children }) => {
  const userManager = useMemo(() => new UserManager(config), [config]);
  return (
    <UserManagerContext.Provider value={userManager}>
      {children}
    </UserManagerContext.Provider>
  );
};

export const useUserManager = () => {
  const context = useContext(UserManagerContext);
  if (!context) {
    throw new Error('useUserManager must be used within a UserManagerProvider');
  }
  return context;
};
