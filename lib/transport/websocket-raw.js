'use strict';

const FayeWebsocket = require('faye-websocket');
const Session = require('../session');
const Transport = require('./transport');
const SockJSConnection = require('../sockjs-connection');
const middleware = require('../middleware');

class RawWebsocketSessionReceiver {
  constructor(req, conn, server, ws) {
    this.ws = ws;
    this.prefix = server.options.prefix;
    this.readyState = Transport.OPEN;
    this.recv = {
      socket: conn,
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

  close(status = 1000, reason = 'Normal closure') {
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

function raw_websocket(req, socket, head, next) {
  const ver = req.headers['sec-websocket-version'] || '';
  if (['8', '13'].indexOf(ver) === -1) {
    return next({
      status: 400,
      message: 'Only supported WebSocket protocol is RFC 6455.'
    });
  }
  const ws = new FayeWebsocket(req, socket, head, null, this.options.faye_server_options);
  ws.onopen = () => {
    new RawWebsocketSessionReceiver(req, socket, this, ws);
  };
  next();
}

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/websocket',
      handlers: [middleware.websocket_check, raw_websocket],
      transport: false
    }
  ]
};
