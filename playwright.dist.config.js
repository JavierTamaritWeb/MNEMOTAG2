'use strict';

const base = require('./playwright.config');

module.exports = {
  ...base,
  use: {
    ...base.use,
    baseURL: 'http://localhost:8081'
  },
  webServer: {
    command: 'python3 -m http.server 8081 -d dist',
    url: 'http://localhost:8081/index.html',
    reuseExistingServer: true,
    timeout: 30000
  }
};
