const nextJest = require('next/jest');
module.exports = nextJest({ dir: './' })({
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
});
