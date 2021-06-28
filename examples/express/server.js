'use strict';

const http = require('http');
const express = require('express');
const sockjs = require('sockjs');

const sockjs_opts = {
  prefix: '/echo'
};

const sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', (conn) => {
  conn.on('data', (msg) => conn.write(msg));
});

const app = express();
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

const server = http.createServer(app);
sockjs_echo.attachServer(server);

server.listen(9999, '0.0.0.0', () => {
  console.log(' [*] Listening on 0.0.0.0:9999');
});
