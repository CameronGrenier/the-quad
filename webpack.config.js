const webpack = require('webpack');

module.exports = {
  target: "webworker",
  mode: "production",
  resolve: {
    fallback: {
      "path": false,
      "fs": false,
      "os": false,
      "crypto": false,
      "buffer": false,
      "stream": false
    }
  }
};