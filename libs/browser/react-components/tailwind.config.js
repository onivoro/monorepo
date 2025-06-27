const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}'),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      colors: {
        'select-background': 'var(--select-background)',
        'select-text': 'var(--select-text)',
        'background': 'var(--background)',
        'background-muted': 'var(--background-muted)',
        'foreground': 'var(--foreground)',
        'foreground-muted': 'var(--foreground-muted)',
        'accent': 'var(--accent)',
        'accent-contrast': 'var(--accent-contrast)',
        'accent-muted': 'var(--accent-muted)',
        'overlay': 'var(--overlay)',
        'primary': 'var(--primary)',
        'primary-contrast': 'var(--primary-contrast)',
        'primary-muted': 'var(--primary-muted)',
        'warn': 'var(--warn)',
        'warn-contrast': 'var(--warn-contrast)',
        'warn-muted': 'var(--warn-muted)',
      },
    },
  },
  plugins: [],
};