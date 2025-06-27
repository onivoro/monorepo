import { ReactNode, FC } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  useMediaQuery,
  useTheme,
  Toolbar,
} from '@mui/material';

import { useNavigate, useLocation } from 'react-router-dom';

interface AppDrawerProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onDrawerToggle: () => void;
  navigationItems: { text: string, icon: ReactNode, path: string }[];
  headerRenderer?: () => ReactNode;
}

export const AppDrawer: FC<AppDrawerProps> = ({
  drawerWidth,
  mobileOpen,
  onDrawerToggle,
  navigationItems,
  headerRenderer,
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleNavigation = (path: string) => {
    navigate(path);
    if (!isDesktop) {
      onDrawerToggle();
    }
  };

  const drawerContent = (
    <Box>
        <Toolbar>{headerRenderer ? headerRenderer() : <></>}</Toolbar>
      <List>
        {navigationItems.map((item) => {
          // Normalize paths for comparison - handle both relative and absolute paths
          const normalizedItemPath = item.path.startsWith('/') ? item.path : `/${item.path}`;
          const isSelected = location.pathname === normalizedItemPath;

          return (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(item.path)}
                sx={{
                  mx: 1,
                  my: 0.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.main + '15',
                    color: theme.palette.primary.main,
                    '&:hover': {
                      backgroundColor: theme.palette.primary.main + '25',
                    },
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 40,
                    color: isSelected
                      ? theme.palette.primary.main
                      : theme.palette.text.secondary,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontSize: '1rem',
                    fontWeight: isSelected ? 600 : 400,
                    color: isSelected
                      ? theme.palette.primary.main
                      : theme.palette.text.primary,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box
      component="nav"
      sx={{ width: isDesktop ? drawerWidth : 0, flexShrink: 0 }}
    >
      {/* Mobile drawer */}
      {!isDesktop && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better performance on mobile
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              backgroundColor: 'background.paper',
              boxSizing: 'border-box',
              width: drawerWidth,
              overflowY: 'scroll',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      {/* Desktop drawer */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              backgroundColor: 'background.paper',
              boxSizing: 'border-box',
              width: drawerWidth,
              position: 'fixed',
              top: 0,
              left: 0,
              overflowY: 'scroll',
              height: '100vh',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      )}
    </Box>
  );
};
