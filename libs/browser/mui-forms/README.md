# @onivoro/browser/mui-forms

A MUI-based forms library that provides a `ManagedForm` component built using @mui/material instead of tailwind.

## Components

### ManagedForm

A form component that automatically manages form state and renders form fields using Material-UI components.

#### Usage

```tsx
import { ManagedForm, TFormFields, TFormLayout } from '@onivoro/browser/mui-forms';

interface FormData {
  name: string;
  email: string;
  age: number;
  subscribe: boolean;
}

const config: TFormFields<FormData> = {
  name: { type: 'text', label: 'Name', validators: { required: true, minLength: 2 } },
  email: { type: 'text', label: 'Email', validators: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ } },
  age: { type: 'number', label: 'Age', validators: { min: 18, max: 120 } },
  subscribe: { type: 'checkbox', label: 'Subscribe to newsletter', validators: { required: true } }
};

const layout: TFormLayout<FormData> = [
  ['name', 'email'],  // Two fields in a row (responsive wrapping at 15rem min-width)
  ['age'],            // Single field takes full width
  ['subscribe']       // Single field takes full width
];

function MyForm() {
  const [formData, setFormData] = useState<FormData>();

  return (
    <ManagedForm
      config={config}
      layout={layout}
      value={formData}
      onChange={setFormData}
    />
  );
}
```

#### Features

- Built with @mui/material components
- Automatic form state management
- Support for various input types: text, number, select, checkbox, date, password, hidden, color, display
- Flexible flex-based layout with wrapping support (responsive design)
- Theme-aware styling (no hardcoded colors - inherits from consumer's MUI theme)
- TypeScript support
- **Real-time validation with error messages** (similar to React Hook Form)
- **No layout shift** - Error message space is always reserved to prevent UI jumping
- Custom field transformers (toFormValue/fromFormValue)
- Consistent error messaging with the original @onivoro/browser/forms library

#### Field Types

- `text` - Material-UI TextField
- `number` - Material-UI TextField with type="number"
- `select` - Material-UI Select with FormControl
- `checkbox` - Material-UI Checkbox with FormControlLabel
- `date` - Material-UI TextField with type="date"
- `password` - Material-UI TextField with type="password"
- `hidden` - Hidden input field
- `color` - Material-UI TextField with type="color"
- `display` - Read-only display field with Material-UI styling

#### Responsive Layout

The ManagedForm uses a flexible layout system that automatically adapts to different screen sizes:

##### Layout Behavior

- **Row-based layout**: Each array in the layout represents a row of fields
- **Flexible wrapping**: Fields in a row will wrap to new lines when the container is too narrow
- **Minimum width**: Each field has a minimum width of 15rem before wrapping occurs
- **Equal distribution**: Fields in the same row share available space equally
- **Responsive gaps**: Spacing between fields uses theme-aware values

##### Layout Examples

```tsx
const layout: TFormLayout<FormData> = [
  ['firstName', 'lastName'],           // Two fields side-by-side (wrap at ~32rem total width)
  ['email'],                          // Single field takes full width
  ['age', 'country', 'phoneNumber'],  // Three fields (wrap as needed based on container width)
  ['newsletter']                      // Single field takes full width
];
```

**Desktop (wide screen):**
```
[firstName    ] [lastName     ]
[email                        ]
[age  ] [country] [phoneNumber]
[newsletter                   ]
```

**Tablet (medium screen):**
```
[firstName    ] [lastName     ]
[email                        ]
[age          ]
[country      ] [phoneNumber  ]
[newsletter                   ]
```

**Mobile (narrow screen):**
```
[firstName                    ]
[lastName                     ]
[email                        ]
[age                          ]
[country                      ]
[phoneNumber                  ]
[newsletter                   ]
```

#### Validation

The ManagedForm component provides real-time validation with automatic error message display. Validation rules are specified in the `validators` property of field configurations.

##### Supported Validators

- **`required: boolean`** - Field is required
- **`minLength: number`** - Minimum character length for text fields
- **`maxLength: number`** - Maximum character length for text fields
- **`min: number`** - Minimum numeric value
- **`max: number`** - Maximum numeric value
- **`pattern: RegExp`** - Regular expression pattern matching

##### Validation Example

```tsx
import { formatRegexes } from '@onivoro/browser/forms';

const config: TFormFields<FormData> = {
  email: {
    type: 'text',
    label: 'Email',
    validators: {
      required: true,
      pattern: formatRegexes.email
    }
  },
  age: {
    type: 'number',
    label: 'Age',
    validators: {
      required: true,
      min: 18,
      max: 120
    }
  },
  password: {
    type: 'password',
    label: 'Password',
    validators: {
      required: true,
      minLength: 8,
      maxLength: 50
    }
  }
};
```

##### Error Messages

Error messages are automatically generated using the same `getErrorMessage` function from `@onivoro/browser/forms`, ensuring consistency across your application. Error messages support:

- Generic validation messages (e.g., "Required", "Must be at least 8 characters")
- Format-specific messages for common patterns (email, phone, SSN, etc.)
- Theme-aware styling through Material-UI's error colors
- **Layout-stable design** - Error message space is always reserved, preventing UI jumps when errors appear/disappear

#### Theming

This library is fully theme-aware and includes no hardcoded styling values. All styling (colors, spacing, border radius, typography) is controlled by the consumer's Material-UI theme. The library automatically uses:

- `theme.spacing()` for all spacing values
- `theme.shape.borderRadius` for border radius
- `theme.palette` colors (inherited through MUI components)
- Material-UI typography variants

To customize the appearance:

```tsx
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { ManagedForm } from '@onivoro/browser/mui-forms';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  spacing: 8, // Base spacing multiplier (theme.spacing(1) = 0.5rem)
  shape: {
    borderRadius: '0.25rem', // Border radius for form elements
  },
  typography: {
    body2: {
      fontSize: '0.875rem', // Used for field labels
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ManagedForm {...props} />
    </ThemeProvider>
  );
}
```

The form components will automatically inherit colors, typography, spacing, border radius, and all other styling from your theme. This ensures consistent styling across your entire application while making the form library completely customizable through your theme configuration.