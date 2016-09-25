'use strict';
const debug = require('debug')('sockjs:trans:websocket');
const FayeWebsocket = require('faye-websocket');

const GenericReceiver = require('./generic-receiver');
const Session = require('./session');
const Transport = require('./transport');
const SockJSConnection = require('./sockjs-connection');

module.exports = {
  _websocket_check(req) {
    if (!FayeWebsocket.isWebSocket(req)) {
      throw ({
        status: 400,
        message: 'Not a valid websocket request'
      });
    }
  },

  sockjs_websocket(req, connection, head) {
    this._websocket_check(req, connection, head);
    const ws = new FayeWebsocket(req, connection, head, null,
      this.options.faye_server_options);
    ws.onopen = () => {
      // websockets possess no session_id
      Session.registerNoSession(req, this, new WebSocketReceiver(ws, connection));
    };
    return true;
  },

  raw_websocket(req, connection, head) {
    this._websocket_check(req, connection, head);
    const ver = req.headers['sec-websocket-version'] || '';
    if (['8', '13'].indexOf(ver) === -1) {
      throw ({
        status: 400,
        message: 'Only supported WebSocket protocol is RFC 6455.'
      });
    }
    const ws = new FayeWebsocket(req, connection, head, null,
      this.options.faye_server_options);
    ws.onopen = () => {
      new RawWebsocketSessionReceiver(req, connection, this, ws);
    };
    return true;
  }
};


class WebSocketReceiver extends GenericReceiver {
  constructor(ws, connection) {
    super(connection);
    debug('new connection');
    this.protocol = 'websocket';
    this.ws = ws;
    this.connection = connection;
    try {
      this.connection.setKeepAlive(true, 5000);
      this.connection.setNoDelay(true);
    } catch (x) {}
    this.ws.addEventListener('close', this.thingy_end_cb);
    this.ws.addEventListener('message', m => this.didMessage(m.data));
    this.heartbeat_cb = () => this.heartbeat_timeout();
  }

  tearDown() {
    this.ws.removeEventListener('close', this.thingy_end_cb);
    super.tearDown();
  }

  didMessage(payload) {
    debug('message', payload);
    if (this.ws && this.session && payload.length > 0) {
      try {
        var message = JSON.parse(payload);
      } catch (x) {
        return this.didClose(3000, 'Broken framing.');
      }
      if (payload[0] === '[') {
        message.forEach((msg) => this.session.didMessage(msg));
      } else {
        this.session.didMessage(message);
      }
    }
  }

  doSendFrame(payload) {
    debug('send', payload);
    if (this.ws) {
      try {
        this.ws.send(payload);
        return true;
      } catch (x) {}
    }
    return false;
  }

  didClose(status=1000, reason='Normal closure') {
    super.didClose(status, reason);
    try {
      this.ws.close(status, reason, false);
    } catch (x) {}
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
    this._end_cb = () => this.didClose();
    this.ws.addEventListener('close', this._end_cb);
    this._message_cb = m => this.didMessage(m);
    this.ws.addEventListener('message', this._message_cb);
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

  didClose() {
    if (!this.ws) {
      return;
    }
    this.ws.removeEventListener('message', this._message_cb);
    this.ws.removeEventListener('close', this._end_cb);
    try {
      this.ws.close(1000, 'Normal closure', false);
    } catch (x) {}
    this.ws = null;

    this.readyState = Transport.CLOSED;
    this.connection.emit('end');
    this.connection.emit('close');
    this.connection = null;
  }
}
