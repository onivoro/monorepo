import React, { useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ManagedForm, TFormFields, TFormLayout } from './index';
import { formatRegexes } from '@onivoro/browser/forms';

// Example form data interface
interface ExampleFormData {
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  country: string;
  newsletter: boolean;
  favoriteColor: string;
}

// Example usage of the MUI ManagedForm
export function ExampleForm() {
  const [formData, setFormData] = useState<ExampleFormData | undefined>();

  // Define form field configuration
  const config: TFormFields<ExampleFormData> = {
    firstName: {
      type: 'text',
      label: 'First Name',
      validators: { required: true, minLength: 2 },
      placeholder: 'Enter your first name'
    },
    lastName: {
      type: 'text',
      label: 'Last Name',
      validators: { required: true, minLength: 2 },
      placeholder: 'Enter your last name'
    },
    email: {
      type: 'text',
      label: 'Email Address',
      validators: { required: true, pattern: formatRegexes.email },
      placeholder: 'Enter your email'
    },
    age: {
      type: 'number',
      label: 'Age',
      validators: { required: true, min: 18, max: 120 },
      placeholder: 'Enter your age'
    },
    country: {
      type: 'select',
      label: 'Country',
      validators: { required: true },
      options: [
        { value: 'us', display: 'United States' },
        { value: 'ca', display: 'Canada' },
        { value: 'uk', display: 'United Kingdom' },
        { value: 'au', display: 'Australia' }
      ]
    },
    newsletter: {
      type: 'checkbox',
      label: 'Subscribe to newsletter',
      validators: { required: true }
    },
    favoriteColor: {
      type: 'color',
      label: 'Favorite Color'
    }
  };

  // Define form layout (rows and columns using flex layout)
  const layout: TFormLayout<ExampleFormData> = [
    ['firstName', 'lastName'],       // Two fields in a row (flex: 1 each)
    ['email'],                       // Single field takes full width
    ['age', 'country'],             // Two fields in a row (flex: 1 each)
    ['favoriteColor'],              // Single field takes full width
    ['newsletter']                  // Single field takes full width
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form Data:', formData);
    alert('Form submitted! Check console for data.');
  };

  const handleReset = () => {
    setFormData(undefined);
  };

  return (
    <Box sx={{ maxWidth: '37.5rem', mx: 'auto', p: (theme) => theme.spacing(3) }}>
      <Typography variant="h4" gutterBottom>
        MUI ManagedForm Example
      </Typography>

      <Typography variant="body1" sx={{ mb: (theme) => theme.spacing(3) }}>
        This form demonstrates the MUI ManagedForm component with various field types.
      </Typography>

      <Box component="form" onSubmit={handleSubmit} sx={{ mb: (theme) => theme.spacing(3) }}>
        <ManagedForm
          config={config}
          layout={layout}
          value={formData}
          onChange={setFormData}
        >
          <Box sx={{ display: 'flex', gap: (theme) => theme.spacing(2), mt: (theme) => theme.spacing(3) }}>
            <Button type="submit" variant="contained">
              Submit
            </Button>
            <Button type="button" variant="outlined" onClick={handleReset}>
              Reset
            </Button>
          </Box>
        </ManagedForm>
      </Box>

      {formData && (
        <Box sx={{ mt: (theme) => theme.spacing(3), p: (theme) => theme.spacing(2), borderRadius: (theme) => theme.shape.borderRadius }}>
          <Typography variant="h6" gutterBottom>
            Current Form Data:
          </Typography>
          <Typography component="pre" variant="body2" sx={{ margin: 0, fontFamily: 'monospace' }}>
            {JSON.stringify(formData, null, 2)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}