import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { Heading } from './Heading';
import { fontSizes } from '../constants/font-sizes.constant';

export default {
  title: 'Components/Heading',
  component: Heading,
  argTypes: {
    fontSize: {
      control: 'select',
      options: Object.keys(fontSizes),
    },
    regular: {
      control: 'boolean',
    },
  },
} as Meta<typeof Heading>;

const Template: StoryFn<typeof Heading> = (args) => <Heading {...args} />;

export const Default = Template.bind({});
Default.args = {
  fontSize: '2xl',
  children: 'Example Heading',
};

// Show all sizes in one story
const AllSizesTemplate: StoryFn<typeof Heading> = (args) => (
  <div className="space-y-4">
    {(Object.keys(fontSizes) as Array<keyof typeof fontSizes>).map((size) => (
      <Heading key={size} {...args} fontSize={size}>
        {size} - Heading Example
      </Heading>
    ))}
  </div>
);

export const AllSizes = AllSizesTemplate.bind({});
AllSizes.args = {
  regular: false,
};

export const WithCustomClass = Template.bind({});
WithCustomClass.args = {
  fontSize: '4xl',
  className: 'text-primary font-bold',
  children: 'Custom Styled Heading',
};