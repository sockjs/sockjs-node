'use strict';

const ResponseReceiver = require('./response-receiver');
const Session = require('../session');
const middleware = require('../middleware');
const xhr = require('./xhr');

class XhrStreamingReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'xhr-streaming';
  }

  sendFrame(payload) {
    return super.sendFrame(payload + '\n');
  }
}

function xhr_streaming(req, res, _head, next) {
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.writeHead(200);

  // IE requires 2KB prefix:
  // http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
  res.write(Array(2049).join('h') + '\n');

  Session.register(req, this, new XhrStreamingReceiver(req, res, this.options) );
  next();
}

module.exports = {
  routes: [
    { method: 'POST', path: '/xhr_streaming', handlers: [middleware.h_sid, middleware.h_no_cache, middleware.xhr_cors, xhr_streaming], transport: true },
    { method: 'OPTIONS', path: '/xhr_streaming', handlers: [middleware.h_sid, middleware.xhr_cors, middleware.xhr_options], transport: true },
    { method: 'POST', path: '/xhr_send', handlers: [middleware.h_sid, middleware.h_no_cache, middleware.xhr_cors, middleware.expect_xhr, xhr.xhr_send], transport: true },
    { method: 'OPTIONS', path: '/xhr_send', handlers: [middleware.h_sid, middleware.xhr_cors, middleware.xhr_options], transport: true },
  ]
};
