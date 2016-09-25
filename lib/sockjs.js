'use strict';

const Server = require('./server');

module.exports.createServer = function createServer(options) {
  return new Server(options);
};

module.exports.listen = function listen(http_server, options) {
  let srv = exports.createServer(options);
  if (http_server) {
    srv.installHandlers(http_server);
  }
  return srv;
};
