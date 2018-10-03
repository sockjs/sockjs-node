'use strict';

const http = require('http');
const express = require('express');
const sockjs = require('sockjs');
const websocket_multiplex = require('websocket-multiplex');

// 1. Setup SockJS server
const sockjs_opts = {
  prefix: '/multiplex'
};
const service = sockjs.createServer(sockjs_opts);

// 2. Setup multiplexing
const multiplexer = new websocket_multiplex.MultiplexServer(service);

const ann = multiplexer.registerChannel('ann');
ann.on('connection', function(conn) {
  conn.write('Ann says hi!');
  conn.on('data', function(data) {
    conn.write('Ann nods: ' + data);
  });
});

const bob = multiplexer.registerChannel('bob');
bob.on('connection', function(conn) {
  conn.write("Bob doesn't agree.");
  conn.on('data', function(data) {
    conn.write('Bob says no to: ' + data);
  });
});

const carl = multiplexer.registerChannel('carl');
carl.on('connection', function(conn) {
  conn.write('Carl says goodbye!');
  // Explicitly cancel connection
  conn.end();
});

// 3. Express server
const app = express();
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
service.attach(server);

server.listen(9999, '0.0.0.0', () => {
  console.log(' [*] Listening on 0.0.0.0:9999');
});
