'use strict';

const ResponseReceiver = require('./response-receiver');
const Session = require('../session');
const middleware = require('../middleware');
const xhr = require('./xhr');

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

module.exports = {
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
