import { viteConfigFactory } from '@onivoro/onix';

export default viteConfigFactory({
    root: __dirname,
    tsconfigPath: 'tsconfig.lib.json',
    cacheDir: '../../../node_modules/.vite/libs/isomorphic/axios',
    outDir: '../../../dist/libs/isomorphic/axios',
});
