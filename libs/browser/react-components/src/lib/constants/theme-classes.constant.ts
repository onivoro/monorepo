/**
 * Utility functions and constants for applying theme-based styling classes
 * These help maintain consistency across components while keeping styling logic in the theme
 */

// Stack component theme classes
export const StackClasses = {
  sectionHeader: 'section-header',
} as const;

// Dialog component theme classes
export const DialogClasses = {
  deleteDialog: 'delete-dialog',
  deleteDialogTitle: 'delete-dialog-title',
  deleteDialogContent: 'delete-dialog-content',
  deleteDialogActions: 'delete-dialog-actions',
} as const;

// DialogContentText theme classes
export const DialogContentTextClasses = {
  deleteDialogPrimary: 'delete-dialog-primary',
  deleteDialogSecondary: 'delete-dialog-secondary',
} as const;

// Typography theme classes
export const TypographyClasses = {
  sectionTitle: 'section-title',
  mainTitle: 'main-title',
} as const;

// TableContainer theme classes
export const TableContainerClasses = {
  glassmorphism: 'glassmorphism',
} as const;

// Table theme classes
export const TableClasses = {
  standardTable: 'standard-table',
} as const;

// TableHead theme classes
export const TableHeadClasses = {
  sectionHeader: 'section-header',
} as const;

// TableRow theme classes
export const TableRowClasses = {
  standardRow: 'standard-row',
} as const;

/**
 * Helper function to create theme-aware sx props that work with the custom classes
 */
export function createThemeSx(className: string, additionalSx?: Record<string, any>) {
  return {
    ...additionalSx,
    '&': {
      [`&.${className}`]: {},
    },
  };
}

/**
 * Common styling patterns that can be reused across components
 */
export const CommonStyles = {
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(0.5rem)',
    boxShadow: '0 0.125rem 0.75rem rgba(50, 49, 45, 0.08)',
    borderRadius: 2,
    border: '1px solid rgba(134, 175, 97, 0.15)',
    overflow: 'hidden',
  },

  sectionHeader: {
    mb: 3,
    p: 2,
    backgroundColor: 'rgba(134, 175, 97, 0.05)',
    borderRadius: 2,
    border: '1px solid rgba(134, 175, 97, 0.1)',
  },

  deleteDialogPaper: {
    borderRadius: 4,
    backgroundColor: 'background.paper',
    border: '2px solid rgba(188, 52, 33, 0.15)',
    boxShadow: '0 0.75rem 2.5rem rgba(188, 52, 33, 0.2)',
    overflow: 'hidden',
  },

  warningIcon: {
    fontSize: '2rem',
    color: 'error.main',
    backgroundColor: 'error.contrastText',
    borderRadius: '50%',
    p: 0.5,
    boxShadow: '0 0.125rem 0.5rem rgba(188, 52, 33, 0.3)',
  },
} as const;
