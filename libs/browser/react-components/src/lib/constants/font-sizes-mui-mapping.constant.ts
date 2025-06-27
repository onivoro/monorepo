import { fontSizes } from './font-sizes.constant';

/**
 * Maps custom fontSizes to equivalent Material-UI typography variants
 *
 * This mapping helps maintain consistency between the existing fontSizes constant
 * and Material-UI's typography system, allowing for easier migration and dual usage.
 */
export const fontSizesToMuiVariantMapping: Record<keyof typeof fontSizes, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'overline' | 'button'> = {
  // Extra small text - best matches caption for helper text
  'xs': 'caption',

  // Small text - best matches body2 for secondary content
  'sm': 'body2',

  // Base text - best matches body1 for primary content
  'base': 'body1',

  // Large text - best matches h6 for small headings
  'lg': 'h6',

  // Extra large - best matches h5 for sub-headings
  'xl': 'h5',

  // 2x large - best matches h4 for section headings
  '2xl': 'h4',

  // 3x large - best matches h3 for subsection headings
  '3xl': 'h3',

  // 4x large - best matches h2 for page section headings
  '4xl': 'h2',

  // 5x large and above - best matches h1 for main page headings
  '5xl': 'h1',
  '6xl': 'h1',
  '7xl': 'h1',
  '8xl': 'h1',
  '9xl': 'h1',
};

/**
 * Reverse mapping from MUI typography variants to fontSizes
 * Useful for converting MUI variants back to fontSizes keys
 */
export const muiVariantToFontSizesMapping: Record<string, keyof typeof fontSizes> = {
  'caption': 'xs',
  'overline': 'xs',
  'body2': 'sm',
  'button': 'sm',
  'body1': 'base',
  'h6': 'lg',
  'h5': 'xl',
  'h4': '2xl',
  'h3': '3xl',
  'h2': '4xl',
  'h1': '5xl',
};

/**
 * Detailed mapping with font size and line height comparisons
 * This provides a more comprehensive view of how the sizes compare
 */
export const fontSizesMuiComparison = {
  'xs': {
    custom: fontSizes.xs,
    mui: 'caption',
    muiStyles: { fontSize: '0.75rem', lineHeight: 1.66 },
    notes: 'Perfect match for helper text and captions'
  },
  'sm': {
    custom: fontSizes.sm,
    mui: 'body2',
    muiStyles: { fontSize: '0.875rem', lineHeight: 1.43 },
    notes: 'Good for secondary text content'
  },
  'base': {
    custom: fontSizes.base,
    mui: 'body1',
    muiStyles: { fontSize: '1rem', lineHeight: 1.5 },
    notes: 'Default body text - exact match'
  },
  'lg': {
    custom: fontSizes.lg,
    mui: 'h6',
    muiStyles: { fontSize: '1rem', lineHeight: 1.6 },
    notes: 'Small headings and emphasis text'
  },
  'xl': {
    custom: fontSizes.xl,
    mui: 'h5',
    muiStyles: { fontSize: '1.25rem', lineHeight: 1.5 },
    notes: 'Sub-headings - exact match'
  },
  '2xl': {
    custom: fontSizes['2xl'],
    mui: 'h4',
    muiStyles: { fontSize: '1.5rem', lineHeight: 1.4 },
    notes: 'Section headings - exact match'
  },
  '3xl': {
    custom: fontSizes['3xl'],
    mui: 'h3',
    muiStyles: { fontSize: '1.75rem', lineHeight: 1.4 },
    notes: 'Subsection headings - close match'
  },
  '4xl': {
    custom: fontSizes['4xl'],
    mui: 'h2',
    muiStyles: { fontSize: '2rem', lineHeight: 1.3 },
    notes: 'Page section headings - close match'
  },
  '5xl': {
    custom: fontSizes['5xl'],
    mui: 'h1',
    muiStyles: { fontSize: '2.5rem', lineHeight: 1.2 },
    notes: 'Main headings - smaller than custom but closest variant'
  },
  '6xl': {
    custom: fontSizes['6xl'],
    mui: 'h1',
    muiStyles: { fontSize: '2.5rem', lineHeight: 1.2 },
    notes: 'Very large headings - custom is larger than MUI h1'
  },
  '7xl': {
    custom: fontSizes['7xl'],
    mui: 'h1',
    muiStyles: { fontSize: '2.5rem', lineHeight: 1.2 },
    notes: 'Display headings - custom is much larger than MUI h1'
  },
  '8xl': {
    custom: fontSizes['8xl'],
    mui: 'h1',
    muiStyles: { fontSize: '2.5rem', lineHeight: 1.2 },
    notes: 'Hero headings - custom is much larger than MUI h1'
  },
  '9xl': {
    custom: fontSizes['9xl'],
    mui: 'h1',
    muiStyles: { fontSize: '2.5rem', lineHeight: 1.2 },
    notes: 'Banner headings - custom is much larger than MUI h1'
  },
} as const;

/**
 * Helper function to get MUI variant for a given fontSizes key
 */
export function getMuiVariantForFontSize(fontSize: keyof typeof fontSizes): 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body1' | 'body2' | 'caption' | 'overline' | 'button' {
  return fontSizesToMuiVariantMapping[fontSize];
}

/**
 * Helper function to get fontSizes key for a given MUI variant
 * Returns the closest fontSizes equivalent
 */
export function getFontSizeForMuiVariant(variant: string): keyof typeof fontSizes | undefined {
  return muiVariantToFontSizesMapping[variant];
}
