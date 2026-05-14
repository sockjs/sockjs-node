import Server from './lib/server.js';

function createServer(options) {
  return new Server(options);
}

function listen(http_server, options) {
  const srv = createServer(options);
  if (http_server) {
    srv.attach(http_server);
  }
  return srv;
}

export default { createServer, listen };
export { createServer, listen };
