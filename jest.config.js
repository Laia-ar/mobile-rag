module.exports = {
  projects: [
    {...require('./jest.unit.config'), displayName: 'logic'},
    {
      displayName: 'native',
      preset: '@react-native/jest-preset',
      testMatch: ['<rootDir>/__tests__/*.test.tsx'],
      // pnpm puts the preset and Flow sources behind an extra .pnpm directory.
      transformIgnorePatterns: ['node_modules/(?!.*(?:react-native|@react-native))'],
    },
  ],
};
