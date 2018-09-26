'use strict';

const sockjs = require('sockjs');
const Hapi = require('hapi');
const Inert = require('inert');

// 1. Echo sockjs server
const sockjs_opts = {
  prefix: '/echo',
  sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1/sockjs.min.js'
};

const sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', function(conn) {
  conn.on('data', function(message) {
    conn.write(message);
  });
});

// Create a server and set port (default host 0.0.0.0)
const hapi_server = new Hapi.Server({
  port: 9999
});

hapi_server.register(Inert).then(() => {
  hapi_server.route({
    method: 'GET',
    path: '/{path*}',
    handler: {
      file: './html/index.html'
    }
  });

  //hapi_server.listener is the http listener hapi uses
  sockjs_echo.attach(hapi_server.listener);
  hapi_server.start().then(() => console.log(' [*] Listening on 0.0.0.0:9999'));
});
