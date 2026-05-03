import path from 'node:path';
import http from 'node:http';
import url from 'node:url';
import express from 'express';
import sockjs from 'sockjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const sockjs_opts = {
  prefix: '/echo'
};

const sockjs_echo = sockjs.createServer(sockjs_opts);
sockjs_echo.on('connection', (conn) => {
  conn.on('data', (msg) => conn.write(msg));
});

const app = express();
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const server = http.createServer(app);
sockjs_echo.attach(server);

server.listen(9999, '0.0.0.0', () => {
  console.log(' [*] Listening on 0.0.0.0:9999');
});
