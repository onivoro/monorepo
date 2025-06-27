import {ReactNode, FC} from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';

interface AppHeaderProps {
  children: ReactNode;
  onMenuClick: () => void;
  drawerWidth: number;
  mobileOpen: boolean;
}

export const AppHeader: FC<AppHeaderProps> = ({
  onMenuClick,
  drawerWidth,
  mobileOpen,
  children,
}) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  return (
    <AppBar
      color='secondary'
      position="fixed"
      sx={{
        width: '100%',
        ml: 0,
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(['width', 'margin'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.leavingScreen,
        }),
      }}
    >
      <Toolbar>
        {!isDesktop && (
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={onMenuClick}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}
        {children}
      </Toolbar>
    </AppBar>
  );
};
