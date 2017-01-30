'use strict';

const events = require('events');

const utils = require('./utils');
const Listener = require('./listener');

class Server extends events.EventEmitter {
  constructor(user_options) {
    super();
    this.options = {
      prefix: '',
      response_limit: 128*1024,
      websocket: true,
      faye_server_options: null,
      jsessionid: false,
      heartbeat_delay: 25000,
      disconnect_delay: 5000,
      log() {},
      sockjs_url: 'https://cdn.jsdelivr.net/sockjs/1/sockjs.min.js'
    };
    Object.assign(this.options, user_options);
  }

  listener(handler_options) {
    const options = Object.assign({}, this.options, handler_options);
    return new Listener(options, this.emit.bind(this));
  }

  installHandlers(http_server, handler_options) {
    const handler = this.listener(handler_options).getHandler();
    utils.overshadowListeners(http_server, 'request', handler);
    utils.overshadowListeners(http_server, 'upgrade', handler);
    return true;
  }
}

module.exports = Server;
