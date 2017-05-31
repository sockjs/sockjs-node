'use strict';
const debug = require('debug')('sockjs:trans:websocket');
const FayeWebsocket = require('faye-websocket');

const GenericReceiver = require('./generic-receiver');
const Session = require('./session');
const Transport = require('./transport');
const SockJSConnection = require('./sockjs-connection');

module.exports = {
  websocket_check(req, socket, head, next) {
    if (!FayeWebsocket.isWebSocket(req)) {
      return next({
        status: 400,
        message: 'Not a valid websocket request'
      });
    }
    next();
  },

  sockjs_websocket(req, socket, head, next) {
    const ws = new FayeWebsocket(req, socket, head, null,
      this.options.faye_server_options);
    ws.once('open', () => {
      // websockets possess no session_id
      Session.registerNoSession(req, this, new WebSocketReceiver(ws, socket));
    });
    next();
  },

  raw_websocket(req, socket, head, next) {
    const ver = req.headers['sec-websocket-version'] || '';
    if (['8', '13'].indexOf(ver) === -1) {
      return next({
        status: 400,
        message: 'Only supported WebSocket protocol is RFC 6455.'
      });
    }
    const ws = new FayeWebsocket(req, socket, head, null,
      this.options.faye_server_options);
    ws.onopen = () => {
      new RawWebsocketSessionReceiver(req, socket, this, ws);
    };
    next();
  }
};


class WebSocketReceiver extends GenericReceiver {
  constructor(ws, socket) {
    super(socket);
    debug('new connection');
    this.protocol = 'websocket';
    this.ws = ws;
    this.connection = socket;
    try {
      this.connection.setKeepAlive(true, 5000);
    } catch (x) {
      // intentionally empty
    }
    this.ws.once('close', this.abort);
    this.ws.on('message', m => this.didMessage(m.data));
    this.heartbeat_cb = () => this.heartbeat_timeout();
  }

  tearDown() {
    this.ws.removeEventListener('close', this.abort);
    super.tearDown();
  }

  didMessage(payload) {
    debug('message', payload);
    if (this.ws && this.session && payload.length > 0) {
      try {
        var message = JSON.parse(payload);
      } catch (x) {
        return this.close(3000, 'Broken framing.');
      }
      if (payload[0] === '[') {
        message.forEach((msg) => this.session.didMessage(msg));
      } else {
        this.session.didMessage(message);
      }
    }
  }

  sendFrame(payload) {
    debug('send', payload);
    if (this.ws) {
      try {
        this.ws.send(payload);
        return true;
      } catch (x) {
        // intentionally empty
      }
    }
    return false;
  }

  close(status=1000, reason='Normal closure') {
    super.close(status, reason);
    try {
      this.ws.close(status, reason, false);
    } catch (x) {
      // intentionally empty
    }
    this.ws = null;
    this.connection = null;
  }

  heartbeat() {
    const supportsHeartbeats = this.ws.ping(null, () => clearTimeout(this.hto_ref));

    if (supportsHeartbeats) {
      this.hto_ref = setTimeout(this.heartbeat_cb, 10000);
    } else {
      super.heartbeat();
    }
  }

  heartbeat_timeout() {
    if (this.session) {
      this.session.close(3000, 'No response from heartbeat');
    }
  }
}

class RawWebsocketSessionReceiver {
  constructor(req, conn, server, ws) {
    this.ws = ws;
    this.prefix = server.options.prefix;
    this.readyState = Transport.OPEN;
    this.recv = {
      connection: conn,
      protocol: 'websocket-raw'
    };

    this.connection = new SockJSConnection(this);
    Session.decorateConnection(req, this.connection, this.recv);
    server.emit('connection', this.connection);

    this._close = this._close.bind(this);
    this.ws.once('close', this._close);

    this.didMessage = this.didMessage.bind(this);
    this.ws.on('message', this.didMessage);
  }

  didMessage(m) {
    if (this.readyState === Transport.OPEN) {
      this.connection.emit('data', m.data);
    }
  }

  send(payload) {
    if (this.readyState !== Transport.OPEN) {
      return false;
    }
    this.ws.send(payload);
    return true;
  }

  close(status=1000, reason='Normal closure') {
    if (this.readyState !== Transport.OPEN) {
      return false;
    }
    this.readyState = Transport.CLOSING;
    this.ws.close(status, reason, false);
    return true;
  }

  _close() {
    if (!this.ws) {
      return;
    }
    this.ws.removeEventListener('message', this.didMessage);
    this.ws.removeEventListener('close', this._close);
    try {
      this.ws.close(1000, 'Normal closure', false);
    } catch (x) {
      // intentionally empty
    }
    this.ws = null;

    this.readyState = Transport.CLOSED;
    this.connection.emit('end');
    this.connection.emit('close');
    this.connection = null;
  }
}
