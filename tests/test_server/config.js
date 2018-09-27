'use strict';

const debug = require('debug')('sockjs:test-server:app');

exports.config = {
  server_opts: {
    sockjs_url: 'http://localhost:8080/lib/sockjs.js',
    websocket: true,
    log: (x, ...rest) => debug(`[${x}]`, ...rest)
  },

  port: 8081
};
