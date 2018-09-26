'use strict';

const debug = require('debug')('sockjs:trans:websocket');
const FayeWebsocket = require('faye-websocket');
const BaseReceiver = require('./base-receiver');
const Session = require('../session');

class WebSocketReceiver extends BaseReceiver {
  constructor(ws, socket) {
    super(socket);
    debug('new connection');
    this.protocol = 'websocket';
    this.ws = ws;
    try {
      socket.setKeepAlive(true, 5000);
    } catch (x) {
      // intentionally empty
    }
    this.ws.once('close', this.abort);
    this.ws.on('message', m => this.didMessage(m.data));
    this.heartbeatTimeout = this.heartbeatTimeout.bind(this);
  }

  tearDown() {
    if (this.ws) {
      this.ws.removeEventListener('close', this.abort);
    }
    super.tearDown();
  }

  didMessage(payload) {
    debug('message');
    if (this.ws && this.session && payload.length > 0) {
      let message;
      try {
        message = JSON.parse(payload);
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
    debug('send');
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
    if (this.ws) {
      try {
        this.ws.close(status, reason, false);
      } catch (x) {
        // intentionally empty
      }
    }
    this.ws = null;
  }

  heartbeat() {
    const supportsHeartbeats = this.ws.ping(null, () => clearTimeout(this.hto_ref));

    if (supportsHeartbeats) {
      this.hto_ref = setTimeout(this.heartbeatTimeout, 10000);
    } else {
      super.heartbeat();
    }
  }

  heartbeatTimeout() {
    if (this.session) {
      this.session.close(3000, 'No response from heartbeat');
    }
  }
}

module.exports = {
  websocket_check(req, _socket, _head, next) {
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
  }
};
