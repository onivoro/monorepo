import { createTheme } from "@mui/material";

export function createMuiTheme() {
    return createTheme({
        palette: {
            common: {
                black: '#363840',
                white: '#FFFFFF'
            },
            mode: 'light',
            primary: {
                main: '#86AF61', // Ivím Health brand green
                light: '#D1E1C4', // Light green for hover/subtle states
                dark: '#648449', // Darker green for active states
                contrastText: '#FFFFFF'
            },
            secondary: {
                main: '#7B867A', // Pine green from brand
                light: '#F0F5EB', // Very light green background
                dark: '#5A6859', // Darker pine for depth
                contrastText: '#FFFFFF'
            },
            error: {
                main: '#BC3421', // Brand red-orange
                light: '#EFCEC7',
                dark: '#B94E36',
                contrastText: '#FFFFFF'
            },
            info: {
                main: '#6186AF', // Brand blue
                light: '#C8DAE8',
                dark: '#4A6B8C',
                contrastText: '#FFFFFF'
            },
            success: {
                main: '#6F9351', // Brand success green
                light: '#D1E1C4',
                dark: '#648449',
                contrastText: '#FFFFFF'
            },
            warning: {
                main: '#D18D52', // Brand orange/tan
                light: '#E8D6C2',
                dark: '#C2925B',
                contrastText: '#FFFFFF'
            },
            text: {
                primary: '#363840', // Dark charcoal for main text
                secondary: 'rgba(50, 49, 45, 0.7)', // Secondary text color from brand
                disabled: 'rgba(50, 49, 45, 0.38)',
            },
            background: {
                default: '#FFFFFF',
                paper: '#FAF9F7', // Warm white background from brand
            },
            grey: {
                50: '#FAF9F7',
                100: '#F1EFED',
                200: '#E5E3D7',
                300: '#D9D8D8',
                400: '#ADADAB',
                500: '#706F6C',
                600: '#555662',
                700: '#373840',
                800: '#363840',
                900: '#1A1A1A',
            },
        },
        typography: {
            fontFamily: [
                'Poppins',
                '-apple-system',
                'BlinkMacSystemFont',
                '"Segoe UI"',
                'Roboto',
                '"Helvetica Neue"',
                'Arial',
                'sans-serif',
                '"Apple Color Emoji"',
                '"Segoe UI Emoji"',
                '"Segoe UI Symbol"',
            ].join(','),
            h1: {
                fontSize: '2.5rem',
                fontWeight: 600,
                lineHeight: 1.2,
                color: '#363840', // Brand dark color for headings
            },
            h2: {
                fontSize: '2rem',
                fontWeight: 600,
                lineHeight: 1.3,
                color: '#363840',
            },
            h3: {
                fontSize: '1.75rem',
                fontWeight: 500,
                lineHeight: 1.4,
                color: '#363840',
            },
            h4: {
                fontSize: '1.5rem',
                fontWeight: 500,
                lineHeight: 1.4,
                color: '#363840',
            },
            h5: {
                fontSize: '1.25rem',
                fontWeight: 500,
                lineHeight: 1.5,
                color: '#363840',
            },
            h6: {
                fontSize: '1rem',
                fontWeight: 500,
                lineHeight: 1.6,
                color: '#363840',
            },
            body1: {
                fontSize: '1rem',
                fontWeight: 400,
                lineHeight: 1.5,
                color: '#363840',
            },
            body2: {
                fontSize: '0.875rem',
                fontWeight: 400,
                lineHeight: 1.43,
                color: 'rgba(50, 49, 45, 0.7)', // Secondary text color
            },
            button: {
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none', // Keep natural casing for healthcare UX
                letterSpacing: '0.02em',
            },
            caption: {
                fontSize: '0.75rem',
                fontWeight: 400,
                lineHeight: 1.66,
                color: 'rgba(50, 49, 45, 0.7)',
            },
            overline: {
                fontSize: '0.75rem',
                fontWeight: 500,
                lineHeight: 2.66,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(50, 49, 45, 0.7)',
            },
        },
        components: {
            // Customize MUI components to match Ivím Health brand
            MuiButton: {
                defaultProps: {
                    // Default buttons should be text buttons, not primary
                    variant: 'text',
                    color: 'inherit',
                },
                styleOverrides: {
                    root: {
                        borderRadius: 999, // Fully rounded corners
                        textTransform: 'none',
                        fontWeight: 500,
                        padding: '0.625rem 1.5rem',
                        fontSize: '0.875rem',
                        // Default button styling (text variant, inherit color)
                        backgroundColor: '#363840',
                        color: 'white',
                        '&:hover': {
                            backgroundColor: '#32312D',
                        },
                    },
                    containedPrimary: {
                        backgroundColor: '#86AF61',
                        color: '#FFFFFF',
                        '&:hover': {
                            backgroundColor: '#648449',
                        },
                        '&:active': {
                            backgroundColor: '#5A7D42',
                        },
                    },
                    containedSecondary: {
                        backgroundColor: '#7B867A',
                        color: '#FFFFFF',
                        '&:hover': {
                            backgroundColor: '#5A6859',
                        },
                        '&:active': {
                            backgroundColor: '#4A5A49',
                        },
                    },
                    containedError: {
                        backgroundColor: '#BC3421',
                        color: '#FFFFFF',
                        '&:hover': {
                            backgroundColor: '#B94E36',
                        },
                        '&:active': {
                            backgroundColor: '#A8432F',
                        },
                    },
                    outlinedPrimary: {
                        borderColor: '#86AF61',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        color: '#86AF61',
                        '&:hover': {
                            borderColor: '#648449',
                            backgroundColor: 'rgba(134, 175, 97, 0.04)',
                            color: '#648449',
                        },
                    },
                    outlinedSecondary: {
                        borderColor: '#7B867A',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        color: '#7B867A',
                        '&:hover': {
                            borderColor: '#5A6859',
                            backgroundColor: 'rgba(123, 134, 122, 0.04)',
                            color: '#5A6859',
                        },
                    },
                    outlinedError: {
                        borderColor: '#BC3421',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        color: '#BC3421',
                        '&:hover': {
                            borderColor: '#B94E36',
                            backgroundColor: 'rgba(188, 52, 33, 0.04)',
                            color: '#B94E36',
                        },
                    },
                    outlinedInfo: {
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        color: '#6186AF'
                    },
                    textPrimary: {
                        color: '#86AF61',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        '&:hover': {
                            backgroundColor: 'rgba(134, 175, 97, 0.04)',
                            color: '#648449',
                        },
                    },
                    textSecondary: {
                        color: '#7B867A',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        '&:hover': {
                            backgroundColor: 'rgba(123, 134, 122, 0.04)',
                            color: '#5A6859',
                        },
                    },
                    textError: {
                        color: '#BC3421',
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        '&:hover': {
                            backgroundColor: 'rgba(188, 52, 33, 0.04)',
                            color: '#B94E36',
                        },
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 999,
                        '&.MuiIconButton-colorSecondary': {
                            color: '#7B867A',
                            '&:hover': {
                                backgroundColor: 'rgba(123, 134, 122, 0.04)',
                                color: '#5A6859',
                            },
                            '&:active': {
                                backgroundColor: 'rgba(123, 134, 122, 0.08)',
                                color: '#4A5A49',
                            },
                        },
                        '&.MuiIconButton-colorPrimary': {
                            color: '#86AF61',
                            '&:hover': {
                                backgroundColor: 'rgba(134, 175, 97, 0.04)',
                                color: '#648449',
                            },
                            '&:active': {
                                backgroundColor: 'rgba(134, 175, 97, 0.08)',
                                color: '#5A7D42',
                            },
                        },
                        '&.MuiIconButton-colorError': {
                            color: '#BC3421',
                            '&:hover': {
                                backgroundColor: 'rgba(188, 52, 33, 0.04)',
                                color: '#B94E36',
                            },
                            '&:active': {
                                backgroundColor: 'rgba(188, 52, 33, 0.08)',
                                color: '#A8432F',
                            },
                        },
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 12,
                        boxShadow: '0 0.125rem 0.75rem rgba(50, 49, 45, 0.08)',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid rgba(50, 49, 45, 0.08)',
                    },
                },
            },
            MuiTextField: {
                styleOverrides: {
                    root: {
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 8,
                            '& fieldset': {
                                borderColor: 'rgba(50, 49, 45, 0.23)',
                            },
                            '&:hover fieldset': {
                                borderColor: '#86AF61',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#86AF61',
                            },
                        },
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 6,
                        fontWeight: 500,
                    },
                    colorPrimary: {
                        backgroundColor: '#D1E1C4',
                        color: '#648449',
                    },
                },
            },
            MuiPaper: {
                styleOverrides: {
                    root: {
                        '&.MuiPaper-elevation1': {
                            boxShadow: '0 0.125rem 0.75rem rgba(50, 49, 45, 0.08)',
                        },
                        '&.MuiTableContainer-root': {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(0.5rem)',
                            boxShadow: '0 0.125rem 0.75rem rgba(50, 49, 45, 0.08)',
                            borderRadius: 8,
                            border: '1px solid rgba(134, 175, 97, 0.15)',
                            overflow: 'hidden',
                        },
                    },
                },
            },
            MuiStack: {
                styleOverrides: {
                    root: {
                        '&.section-header': {
                            marginBottom: '1.5rem',
                            padding: '1rem',
                            backgroundColor: 'rgba(134, 175, 97, 0.05)',
                            borderRadius: 8,
                            border: '1px solid rgba(134, 175, 97, 0.1)',
                        },
                    },
                },
            },
            MuiDialog: {
                styleOverrides: {
                    paper: {
                        '&.delete-dialog': {
                            borderRadius: 16,
                            backgroundColor: '#FFFFFF',
                            border: '2px solid rgba(188, 52, 33, 0.15)',
                            boxShadow: '0 0.75rem 2.5rem rgba(188, 52, 33, 0.2)',
                            overflow: 'hidden',
                        },
                    },
                },
            },
            MuiDialogTitle: {
                styleOverrides: {
                    root: {
                        '&.delete-dialog-title': {
                            backgroundColor: 'rgba(188, 52, 33, 0.08)',
                            color: '#BC3421',
                            fontWeight: 700,
                            fontSize: '1.25rem',
                            borderBottom: '2px solid rgba(188, 52, 33, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            paddingTop: '1.5rem',
                            paddingBottom: '1.5rem',
                            paddingLeft: '1.5rem',
                            paddingRight: '1.5rem',
                        },
                    },
                },
            },
            MuiDialogContent: {
                styleOverrides: {
                    root: {
                        '&.delete-dialog-content': {
                            paddingTop: '1.5rem',
                            paddingBottom: '1rem',
                            paddingLeft: '1.5rem',
                            paddingRight: '1.5rem',
                        },
                    },
                },
            },
            MuiDialogActions: {
                styleOverrides: {
                    root: {
                        '&.delete-dialog-actions': {
                            padding: '1.5rem',
                            paddingTop: '0.5rem',
                            gap: '1rem',
                            backgroundColor: 'rgba(250, 249, 247, 0.8)',
                            borderTop: '1px solid rgba(134, 175, 97, 0.1)',
                        },
                    },
                },
            },
            MuiDialogContentText: {
                styleOverrides: {
                    root: {
                        '&.delete-dialog-primary': {
                            color: '#363840',
                            fontSize: '1rem',
                            lineHeight: 1.6,
                            marginBottom: '1rem',
                        },
                        '&.delete-dialog-secondary': {
                            color: 'rgba(50, 49, 45, 0.7)',
                            fontSize: '0.875rem',
                            fontStyle: 'italic',
                        },
                    },
                },
            },
            MuiTypography: {
                styleOverrides: {
                    root: {
                        '&.section-title': {
                            color: '#363840',
                            fontWeight: 600,
                        },
                        '&.main-title': {
                            color: '#363840', // Brand charcoal
                            fontWeight: 600,
                            textShadow: '0 0.0625rem 0.125rem rgba(50, 49, 45, 0.1)',
                        },
                    },
                },
            },
            MuiTableContainer: {
                styleOverrides: {
                    root: {
                        '&.glassmorphism': {
                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                            backdropFilter: 'blur(0.5rem)',
                            boxShadow: '0 0.125rem 0.75rem rgba(50, 49, 45, 0.08)',
                            borderRadius: 2,
                            border: '1px solid rgba(134, 175, 97, 0.15)',
                            overflow: 'hidden',
                        },
                    },
                },
            },
            MuiTable: {
                styleOverrides: {
                    root: {
                        '&.standard-table': {
                            minWidth: 650,
                        },
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        '&.section-header': {
                            backgroundColor: 'rgba(134, 175, 97, 0.08)',
                            '& .MuiTableCell-head': {
                                fontWeight: 600,
                                color: '#363840',
                                borderBottom: '2px solid rgba(134, 175, 97, 0.2)',
                            },
                        },
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        '&.standard-row': {
                            '&:last-child td, &:last-child th': {
                                border: 0
                            },
                        },
                    },
                },
            },
        },
    });
}