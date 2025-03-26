const path = require('path');

module.exports = {
  entry: './client/src/worker.js',
  output: {
    filename: 'worker.js',
    path: path.resolve(__dirname, 'dist'),
  },
  target: 'webworker',
  mode: process.env.NODE_ENV || 'production',
};