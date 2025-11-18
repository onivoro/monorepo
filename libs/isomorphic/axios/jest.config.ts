export default {
  displayName: 'lib-isomorphic-axios',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/isomorphic/axios',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  maxWorkers: 1, // Run tests serially to avoid connection issues
  detectOpenHandles: false, // Disable to prevent warnings about axios connections
  forceExit: true, // Force exit after tests complete to handle lingering connections
};