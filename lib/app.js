'use strict';

const GenericApp = require('./generic-app');
const utils = require('./utils');

const trans_websocket = require('./trans-websocket');
const trans_jsonp = require('./trans-jsonp');
const trans_xhr = require('./trans-xhr');
const iframe = require('./iframe');
const trans_eventsource = require('./trans-eventsource');
const trans_htmlfile = require('./trans-htmlfile');
const chunking_test = require('./chunking-test');

class App extends GenericApp {
  constructor(options, emit) {
    super();
    this.options = options;
    this.emit = emit;
  }

  welcome_screen(req, res) {
    res.setHeader('content-type', 'text/plain; charset=UTF-8');
    res.writeHead(200);
    res.end('Welcome to SockJS!\n');
    return true;
  }

  handle_404(req, res) {
    res.setHeader('content-type', 'text/plain; charset=UTF-8');
    res.writeHead(404);
    res.end('404 Error: Page not found\n');
    return true;
  }

  disabled_transport(req, res, data) {
    return this.handle_404(req, res, data);
  }

  h_sid(req, res, data) {
    // Some load balancers do sticky sessions, but only if there is
    // a JSESSIONID cookie. If this cookie isn't yet set, we shall
    // set it to a dummy value. It doesn't really matter what, as
    // session information is usually added by the load balancer.
    req.cookies = utils.parseCookie(req.headers.cookie);
    if (typeof this.options.jsessionid === 'function') {
      // Users can supply a function
      this.options.jsessionid(req, res);
    } else if (this.options.jsessionid && res.setHeader) {
      // We need to set it every time, to give the loadbalancer
      // opportunity to attach its own cookies.
      let jsid = req.cookies['JSESSIONID'] || 'dummy';
      res.setHeader('Set-Cookie', `JSESSIONID=${jsid}; path=/`);
    }
    return data;
  }

  log(severity, line) {
    return this.options.log(severity, line);
  }
}

Object.assign(App.prototype,
  iframe,
  chunking_test,
  trans_websocket,
  trans_jsonp,
  trans_xhr,
  trans_eventsource,
  trans_htmlfile
);

module.exports = App;
