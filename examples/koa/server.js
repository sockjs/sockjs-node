import Koa from 'koa';
import sockjs from 'sockjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// 1. Echo sockjs server
const sockjs_opts = {
  prefix: '/echo'
};
const sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', function (conn) {
  conn.on('data', function (message) {
    conn.write(message);
  });
});

// 2. koa server
const app = new Koa();

app.use(function (ctx, next) {
  return next().then(() => {
    const filePath = path.join(__dirname, 'index.html');
    ctx.response.type = path.extname(filePath);
    ctx.response.body = fs.createReadStream(filePath);
  });
});

const server = http.createServer(app.callback());
sockjs_echo.attach(server);

server.listen(9999, '0.0.0.0');
console.log(' [*] Listening on 0.0.0.0:9999');
