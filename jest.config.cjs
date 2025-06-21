const path = require('path');

module.exports = {
  testEnvironment: "node",
  transform: {
    '^.+\\.(js|mjs)$': ['babel-jest', { configFile: path.resolve(__dirname, 'babel.config.cjs') }],
  },
  transformIgnorePatterns: [
    "/node_modules/",
    "\\.pnp\\.[^\\/]+$"
  ],
};
