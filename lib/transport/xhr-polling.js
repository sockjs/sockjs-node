import ResponseReceiver from './response-receiver.js';
import Session from '../session.js';
import middleware from '../middleware.js';
import xhr from './xhr.js';

class XhrPollingReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'xhr-polling';
    this.max_response_size = 1;
  }

  sendFrame(payload) {
    return super.sendFrame(payload + '\n');
  }
}

function xhr_poll(req, res, _head, next) {
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.writeHead(200);

  Session.register(req, this, new XhrPollingReceiver(req, res, this.options));
  next();
}

export default {
  routes: [
    {
      method: 'POST',
      path: '/xhr',
      handlers: [middleware.h_sid, middleware.h_no_cache, middleware.xhr_cors, xhr_poll],
      transport: true
    },
    {
      method: 'OPTIONS',
      path: '/xhr',
      handlers: [middleware.h_sid, middleware.xhr_cors, middleware.xhr_options],
      transport: true
    },
    {
      method: 'POST',
      path: '/xhr_send',
      handlers: [
        middleware.h_sid,
        middleware.h_no_cache,
        middleware.xhr_cors,
        middleware.expect_xhr,
        xhr.xhr_send
      ],
      transport: true
    },
    {
      method: 'OPTIONS',
      path: '/xhr_send',
      handlers: [middleware.h_sid, middleware.xhr_cors, middleware.xhr_options],
      transport: true
    }
  ]
};
