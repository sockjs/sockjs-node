'use strict';

const GenericApp = require('./generic-app');
const utils = require('./utils');

const trans_websocket = require('./transport/websocket');
const trans_websocket_raw = require('./transport/websocket-raw');
const trans_jsonp_polling = require('./transport/jsonp-polling');
const trans_xhr_polling = require('./transport/xhr-polling');
const trans_xhr_streaming = require('./transport/xhr-streaming');
const iframe = require('./transport/iframe');
const trans_eventsource = require('./transport/eventsource');
const trans_htmlfile = require('./transport/htmlfile');
const info = require('./info');

class App extends GenericApp {
  constructor(options, emit) {
    super(options, emit);
  }

  welcome_screen(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(200);
    res.end('Welcome to SockJS!\n');
  }

  handle_404(req, res) {
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(404);
    res.end('404 Error: Page not found\n');
  }

  h_sid(req, res, _head, next) {
    // Some load balancers do sticky sessions, but only if there is
    // a JSESSIONID cookie. If this cookie isn't yet set, we shall
    // set it to a dummy value. It doesn't really matter what, as
    // session information is usually added by the load balancer.
    req.cookies = utils.parseCookie(req.headers.cookie);
    if (typeof this.options.jsessionid === 'function') {
      // Users can supply a function
      this.options.jsessionid(req, res);
    } else if (this.options.jsessionid) {
      // We need to set it every time, to give the loadbalancer
      // opportunity to attach its own cookies.
      const jsid = req.cookies['JSESSIONID'] || 'dummy';
      res.setHeader('Set-Cookie', `JSESSIONID=${jsid}; path=/`);
    }
    next();
  }
}

Object.assign(App.prototype,
  iframe,
  info,
  trans_websocket,
  trans_websocket_raw,
  trans_jsonp_polling,
  trans_xhr_polling,
  trans_xhr_streaming,
  trans_eventsource,
  trans_htmlfile
);

module.exports = App;
