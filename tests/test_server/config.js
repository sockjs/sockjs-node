import createDebug from 'debug';

const debug = createDebug('sockjs:test-server:app');

export default {
  server_opts: {
    sockjs_url: 'http://localhost:8080/lib/sockjs.js',
    websocket: true,
    log: (x, ...rest) => debug(`[${x}]`, ...rest)
  },

  port: 8081
};
