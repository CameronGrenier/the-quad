export default {
  // Use babel-jest for transforming
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest'
  },
  // Testing environment
  testEnvironment: 'node',
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Display detailed output
  verbose: true,
  // Coverage collection
  collectCoverage: true,
  collectCoverageFrom: [
    'client/src/controllers/**/*.js',
    'client/src/services/**/*.js',
    'client/src/utils/**/*.js'
  ],
  // Module resolution
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Fix the problem with utils.js imports
    './utils.js': '<rootDir>/client/src/utils/index.js',
  },
  // Make sure node_modules aren't processed
  transformIgnorePatterns: [
    '/node_modules/'
  ],
  // Set up ES modules handling
  extensionsToTreatAsEsm: [],
}