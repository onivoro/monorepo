import type { Meta, StoryFn } from '@storybook/react';
import { Button, ThemeProvider } from '@mui/material';
import { ColorGrid, VariantGrid} from './Theme';
import { createMuiTheme } from '../functions/create-mui-theme.function';

export default {
  title: 'Components/Button',
  component: Button,
} as Meta<typeof Button>;

const Template: StoryFn<typeof Button> = (args) => <ThemeProvider theme={createMuiTheme()}>
  <VariantGrid renderer={({ variantName, variantValue }) =>
    <div key={variantName}>
      <h3>variant={variantName}</h3>
      <ColorGrid renderer={({ name }) =>
        <div key={name}>
          <Button variant={variantValue as any} {...args} color={name as any}>color={name}</Button>
        </div>
      } />
    </div>
  }></VariantGrid>
</ThemeProvider>

export const Default = Template.bind({});
Default.args = {
  onClick: () => alert('Button clicked!'),
};