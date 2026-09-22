/* eslint-disable */
export default {
  displayName: 'lib-browser-agentic-mui',
  preset: '../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'html'],
  moduleNameMapper: {
    // see src/test/esm-stub.js
    '^react-markdown$': '<rootDir>/src/test/esm-stub.js',
    '^remark-gfm$': '<rootDir>/src/test/esm-stub.js',
  },
  coverageDirectory: '../../../coverage/libs/browser/agentic-mui',
};
