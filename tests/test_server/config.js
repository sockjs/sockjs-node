'use strict';
exports.config = {
  server_opts: {
    sockjs_url: 'http://localhost:8080/lib/sockjs.js',
    websocket: true,
    log: console.log
  },

  port: 8081,
  host: '0.0.0.0'
};
