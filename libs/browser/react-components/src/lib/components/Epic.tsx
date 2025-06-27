import React, { PropsWithChildren } from 'react';
import { Box, Typography, CircularProgress, Backdrop } from '@mui/material';

export interface EpicProps {
  /**
   * Optional error object to display instead of loading state
   */
  error?: any;

  /**
   * Background hero image URL
   */
  heroImage?: string;

  /**
   * Application title to display
   */
  title?: string;

  subtitle?: string;

  /**
   * Logo image URL to display above the title
   */
  logoImage?: string;

  /**
   * Custom background gradient override
   */
  backgroundGradient?: string;

  /**
   * Custom title styling
   */
  titleSx?: object;

  /**
   * Whether to show the loading spinner
   */
  showLoading?: boolean;
}

/**
 * Epic loading component with hero background and centered content.
 * Can display either a loading state with spinner or an error state with details.
 */
export const Epic: React.FC<PropsWithChildren<EpicProps>> = ({
  error,
  heroImage = 'hero.png',
  title,
  subtitle,
  logoImage,
  backgroundGradient = `linear-gradient(135deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(240, 245, 235, 0.6) 30%,
    rgba(240, 245, 235, 0.8) 50%,
    rgba(240, 245, 235, 0.6) 70%,
    rgba(255, 255, 255, 0.4) 100%)`,
  titleSx,
  children,
  showLoading = false
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        minHeight: '100vh',
        backgroundImage: `${backgroundGradient}, url(${heroImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'stretch',
          alignItems: 'stretch',
          px: 2,
          py: 6,
          flexGrow: 1,
          gap: 8
        }}
      >
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            flexGrow: 1,
            py: 8
          }}
        >
          {(logoImage || title) && <Box>
            {logoImage && (
              <Box
                sx={{
                  color: 'text.secondary',
                  textAlign: 'center',
                  display: 'flex',
                  justifyContent: 'center',
                  mb: 2
                }}
              >
                <img style={{ height: '1.4rem' }} src={logoImage} alt="Logo" />
              </Box>
            )}

            {title && <Typography
              variant="h1"
              sx={{
                fontFamily: 'Georgia',
                fontSize: '10rem',
                color: 'white',
                textAlign: 'center',
                textShadow: '0 0.1875rem 0.0625rem rgba(0,0,0,0.2), 0 0.125rem 0.125rem rgba(0,0,0,0.14), 0 0.0625rem 0.3125rem rgba(0,0,0,0.12)',
                ...titleSx
              }}
              fontWeight="400"
            >
              {title}
            </Typography>}

            {subtitle && <Typography
              variant="h2"
              sx={{
                fontFamily: 'Georgia',
                // fontSize: '4rem',
                color: 'white',
                textAlign: 'center',
                textShadow: '0 0.1875rem 0.0625rem rgba(0,0,0,0.2), 0 0.125rem 0.125rem rgba(0,0,0,0.14), 0 0.0625rem 0.3125rem rgba(0,0,0,0.12)',
              }}
              fontWeight="400"
            >
              {subtitle}
            </Typography>}
          </Box>}

          {error ? (
            <Box>
              <Typography
                variant="h2"
                sx={{
                  fontSize: '3rem',
                  color: 'primary.main',
                  textAlign: 'center'
                }}
                fontWeight="400"
              >
                Authentication Failed
              </Typography>
              <Box
                sx={{
                  color: 'text.secondary',
                  fontSize: '1.25rem',
                  textAlign: 'center'
                }}
              >
                {JSON.stringify(error, null, 2)}
              </Box>
            </Box>
          ) : (
            showLoading && (
              <Backdrop
                sx={{ color: 'inherit', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                open={true}
              >
                <CircularProgress />
              </Backdrop>
            )
          )}
          <Box>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};