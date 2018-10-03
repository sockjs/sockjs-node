'use strict';

const Koa = require('koa');
const sockjs = require('sockjs');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 1. Echo sockjs server
const sockjs_opts = {
  prefix: '/echo',
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js'
};
const sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', function(conn) {
  conn.on('data', function(message) {
    conn.write(message);
  });
});

// 2. koa server
const app = new Koa();

app.use(function(ctx, next) {
  return next().then(() => {
    const filePath = __dirname + '/index.html';
    ctx.response.type = path.extname(filePath);
    ctx.response.body = fs.createReadStream(filePath);
  });
});

const server = http.createServer(app.callback());
sockjs_echo.attach(server);

server.listen(9999, '0.0.0.0');
console.log(' [*] Listening on 0.0.0.0:9999');
