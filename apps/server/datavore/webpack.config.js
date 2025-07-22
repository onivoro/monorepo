const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    output: {
      path: join(__dirname, '../../../dist/apps/server/datavore'),
    },
    plugins: [
      new NxAppWebpackPlugin({
        target: 'node',
        compiler: 'tsc',
        main: './src/main.ts',
        tsConfig: './tsconfig.app.json',
        assets: ["./src/assets"],
        optimization: isProduction,
        outputHashing: 'none',
        generatePackageJson: true,
      })
    ],
  };
};
