import { PropsWithChildren, FC } from 'react';
import { fontSizes } from '../constants/font-sizes.constant';
import { fontSizesToMuiVariantMapping, getMuiVariantForFontSize } from '../constants/font-sizes-mui-mapping.constant';
import { Typography, TypographyVariant } from '@mui/material';

export interface HeadingProps {
  /**
   * Custom fontSize from the fontSizes constant
   * When provided, this will be mapped to the closest MUI typography variant
   */
  fontSize?: keyof typeof fontSizes;

  /**
   * Direct MUI typography variant
   * Takes precedence over fontSize prop if both are provided
   */
  variant?: TypographyVariant;

  /** Custom CSS class name */
  className?: string;

  /** If true, uses regular font weight instead of bold */
  regular?: boolean;

  /** The HTML element to render as */
  component?: React.ElementType;

  /** Custom inline styles */
  style?: React.CSSProperties;
}

export const Heading: FC<PropsWithChildren<HeadingProps>> = ({
  className,
  regular,
  fontSize,
  variant,
  children,
  component = 'div',
  style,
  ...rest
}) => {
  // Determine which variant to use - explicit variant takes precedence
  const typographyVariant = variant || (fontSize ? getMuiVariantForFontSize(fontSize) : 'h6');

  // If fontSize is provided but no variant, also apply the custom styles for exact matching
  const customStyles = fontSize && !variant ? {
    fontSize: fontSizes[fontSize].fontSize,
    lineHeight: fontSizes[fontSize].lineHeight,
    ...style
  } : style;

  return (
    <Typography
      variant={typographyVariant}
      component={component}
      className={className}
      fontWeight={regular ? 'normal' : 'bold'}
      style={customStyles}
      {...rest}
    >
      {children}
    </Typography>
  );
}

export default Heading;
