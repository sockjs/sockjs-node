'use strict';

const events = require('events');
const url = require('url');
const debug = require('debug')('sockjs:server');
const listener = require('./listener');
const webjs = require('./webjs');
const pkg = require('../package.json');

class Server extends events.EventEmitter {
  constructor(user_options) {
    super();
    this.options = Object.assign(
      {
        prefix: '',
        transports: [
          'eventsource',
          'htmlfile',
          'jsonp-polling',
          'websocket',
          'websocket-raw',
          'xhr-polling',
          'xhr-streaming'
        ],
        response_limit: 128 * 1024,
        faye_server_options: null,
        jsessionid: false,
        heartbeat_delay: 25000,
        disconnect_delay: 5000,
        log() {},
        sockjs_url: 'https://cdn.jsdelivr.net/sockjs/1/sockjs.min.js'
      },
      user_options
    );

    // support old options.websocket setting
    if (user_options.websocket === false) {
      const trs = new Set(this.options.transports);
      trs.delete('websocket');
      trs.delete('websocket-raw');
      this.options.transports = Array.from(trs.values());
    }

    this._prefixMatches = () => true;
    if (this.options.prefix) {
      // remove trailing slash, but not leading
      this.options.prefix = this.options.prefix.replace(/\/$/, '');
      this._prefixMatches = requrl => url.parse(requrl).pathname.startsWith(this.options.prefix);
    }

    this.options.log(
      'debug',
      `SockJS v${pkg.version} bound to ${JSON.stringify(this.options.prefix)}`
    );
    this.handler = webjs.generateHandler(this, listener.generateDispatcher(this.options));
  }

  attach(server) {
    this._rlisteners = this._installListener(server, 'request');
    this._ulisteners = this._installListener(server, 'upgrade');
  }

  detach(server) {
    if (this._rlisteners) {
      this._removeListener(server, 'request', this._rlisteners);
      this._rlisteners = null;
    }
    if (this._ulisteners) {
      this._removeListener(server, 'upgrade', this._ulisteners);
      this._ulisteners = null;
    }
  }

  _removeListener(server, eventName, listeners) {
    server.removeListener(eventName, this.handler);
    listeners.forEach(l => server.on(eventName, l));
  }

  _installListener(server, eventName) {
    const listeners = server.listeners(eventName).filter(x => x !== this.handler);
    server.removeAllListeners(eventName);
    server.on(eventName, (req, res, head) => {
      if (this._prefixMatches(req.url)) {
        debug('prefix match', eventName, req.url, this.options.prefix);
        this.handler(req, res, head);
      } else {
        listeners.forEach(l => l.call(server, req, res, head));
      }
    });
    return listeners;
  }
}

module.exports = Server;
