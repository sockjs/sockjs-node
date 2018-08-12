'use strict';

const Server = require('./lib/server');

module.exports.createServer = function createServer(options) {
  return new Server(options);
};

module.exports.listen = function listen(http_server, options) {
  const srv = exports.createServer(options);
  if (http_server) {
    srv.installHandlers(http_server);
  }
  return srv;
};
