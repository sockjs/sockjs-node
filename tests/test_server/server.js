'use strict';
const http = require('http');
const config = require('./config').config;
const sockjs_app = require('./sockjs_app');

const server = http.createServer();
server.addListener('request', function(req, res) {
  res.setHeader('content-type', 'text/plain');
  res.writeHead(404);
  res.end('404 - Nothing here (via sockjs-node test_server)');
});
server.addListener('upgrade', function(req, res){
  res.end();
});

sockjs_app.install(config.server_opts, server);

server.listen(config.port, config.host, () => {
  const addr = server.address();
  console.log(` [*] Listening on ${addr.address}:${addr.port}`);
});
