'use strict';

var http = require('http');
var sockjs = require('sockjs');
const node_static = require('node-static');


var echo = sockjs.createServer({ sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.0.1/sockjs.min.js' });
echo.on('connection', function(conn) {
    conn.on('data', function(message) {
        conn.write(message);
    });
    conn.on('close', function() {});
});

// 2. Static files server
const static_directory = new node_static.Server(__dirname);

// 3. Usual http stuff
const server = http.createServer();
server.addListener('request', function(req, res) {
  static_directory.serve(req, res);
});
server.addListener('upgrade', function(req, res) {
  res.end();
});

echo.installHandlers(server, {prefix:'/echo'});
server.listen(5435, '0.0.0.0');
