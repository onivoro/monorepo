/* eslint-disable */
// The date snapshots were recorded in this zone; pin it so they pass on any machine, including CI.
process.env.TZ = 'America/Chicago';

export default {
  displayName: 'lib-isomorphic-common',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/isomorphic/common',
};
