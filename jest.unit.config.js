module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/knowledgeManifest.test.ts'],
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest',
  },
};
