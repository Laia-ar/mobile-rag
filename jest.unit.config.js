module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/*.test.ts'],
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
};
