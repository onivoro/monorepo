import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * This package ships CommonJS, and a bundler cannot tree-shake a `require` of a
 * barrel: one `import { Psychology } from '@mui/icons-material'` put every
 * icon MUI publishes into a consuming app's bundle, several megabytes of them.
 * Path imports keep it to the components actually used.
 */
describe('MUI imports', () => {
  it('never imports from the @mui/material or @mui/icons-material barrels', () => {
    const offenders = readdirSync(__dirname)
      .filter((f) => f.endsWith('.tsx') && !f.endsWith('.spec.tsx'))
      .filter((f) =>
        /from '@mui\/(material|icons-material)'/.test(
          readFileSync(join(__dirname, f), 'utf8'),
        ),
      );

    expect(offenders).toEqual([]);
  });
});
