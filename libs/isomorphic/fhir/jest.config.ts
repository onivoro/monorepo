export default {
  displayName: 'lib-isomorphic-fhir',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/isomorphic/fhir',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/lib/functions/test-setup.ts'],
  maxWorkers: 1, // Run tests serially to avoid connection issues
  detectOpenHandles: false, // Disable to prevent warnings about axios connections
  forceExit: true, // Force exit after tests complete to handle lingering connections
};