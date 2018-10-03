'use strict';

const express = require('express');
const http = require('http');
const sockjs = require('sockjs');

// 1. Echo sockjs server
const sockjs_opts = {
  prefix: '/echo',
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js'
};

var sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', function(conn) {
  conn.on('data', function(message) {
    conn.write(message);
  });
});

// 2. Express server
const app = express();
app.get('/', function(req, res) {
  res.sendFile(__dirname + '/index.html');
});

const server = http.createServer(app);
sockjs_echo.attach(server);

server.listen(9999, '0.0.0.0', () => {
  console.log(' [*] Listening on 0.0.0.0:9999');
});
