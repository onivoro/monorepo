import React, { ReactNode, useState } from 'react';
import { Box, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import { AppHeader } from './AppHeader';
import { AppDrawer } from './AppDrawer';

interface AppLayoutProps {
  children: React.ReactNode;
  drawerWidth?: number;
  mainHeaderRenderer?: () => React.ReactNode;
  sideHeaderRenderer?: () => React.ReactNode;
  navigationItems: { text: string, icon: ReactNode, path: string }[]
}

const DRAWER_WIDTH = 280;

export const AppLayout: React.FC<AppLayoutProps> = ({ children, drawerWidth = DRAWER_WIDTH, mainHeaderRenderer, sideHeaderRenderer, navigationItems }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppHeader
        onMenuClick={handleDrawerToggle}
        drawerWidth={drawerWidth}
        mobileOpen={mobileOpen}
      >
        {mainHeaderRenderer ? mainHeaderRenderer() : <></>}
      </AppHeader>
      <AppDrawer
        drawerWidth={drawerWidth}
        mobileOpen={mobileOpen}
        onDrawerToggle={handleDrawerToggle}
        headerRenderer={sideHeaderRenderer}
        navigationItems={navigationItems}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: isDesktop ? `calc(100% - ${drawerWidth/16}rem)` : '100%',
          bgcolor: 'background.default',
        }}
      >
        <Toolbar /> {/* This adds spacing for the fixed AppBar */}
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};
