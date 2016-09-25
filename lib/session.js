'use strict';

const debug = require('debug')('sockjs:session');
const Transport = require('./transport');
const SockJSConnection = require('./sockjs-connection');

const MAP = {};
function closeFrame(status, reason) {
  return `c${JSON.stringify([status, reason])}`;
}

class Session {
  static bySessionId(session_id) {
    if (!session_id) {
      return null;
    }
    return MAP[session_id] || null;
  }

  static _register(req, server, session_id, receiver) {
    let session = Session.bySessionId(session_id);
    if (!session) {
      debug('create new session', session_id);
      session = new Session(session_id, server);
    }
    session.register(req, receiver);
    return session;
  }

  static register(req, server, receiver) {
    debug('static register');
    return Session._register(req, server, req.session, receiver);
  }

  static registerNoSession(req, server, receiver) {
    debug('static registerNoSession');
    return Session._register(req, server, undefined, receiver);
  }

  constructor(session_id, server) {
    this.session_id = session_id;
    this.heartbeat_delay = server.options.heartbeat_delay;
    this.disconnect_delay = server.options.disconnect_delay;
    this.prefix = server.options.prefix;
    this.send_buffer = [];
    this.is_closing = false;
    this.readyState = Transport.CONNECTING;
    if (this.session_id) {
      MAP[this.session_id] = this;
    }
    this.timeout_cb = () => this.didTimeout();
    this.to_tref = setTimeout(this.timeout_cb, this.disconnect_delay);
    this.connection = new SockJSConnection(this);
    this.emit_open = () => {
      this.emit_open = null;
      server.emit('connection', this.connection);
    };
  }

  register(req, recv) {
    if (this.recv) {
      recv.doSendFrame(closeFrame(2010, 'Another connection still open'));
      recv.didClose();
      return;
    }
    if (this.to_tref) {
      clearTimeout(this.to_tref);
      this.to_tref = null;
    }
    if (this.readyState === Transport.CLOSING) {
      this.flushToRecv(recv);
      recv.doSendFrame(this.close_frame);
      recv.didClose();
      this.to_tref = setTimeout(this.timeout_cb, this.disconnect_delay);
      return;
    }
    // Registering. From now on 'unregister' is responsible for
    // setting the timer.
    this.recv = recv;
    this.recv.session = this;

    // Save parameters from request
    this.decorateConnection(req);

    // first, send the open frame
    if (this.readyState === Transport.CONNECTING) {
      this.recv.doSendFrame('o');
      this.readyState = Transport.OPEN;
      // Emit the open event, but not right now
      process.nextTick(this.emit_open);
    }

    // At this point the transport might have gotten away (jsonp).
    if (!this.recv) {
      return;
    }
    this.tryFlush();
  }

  decorateConnection(req) {
    Session.decorateConnection(req, this.connection, this.recv);
  }

  static decorateConnection(req, connection, recv) {
    let socket = recv.connection;
    if (!socket) {
      socket = recv.response.connection;
    }
    // Store the last known address.
    let remoteAddress, remotePort, address;
    try {
      remoteAddress = socket.remoteAddress;
      remotePort = socket.remotePort;
      address = socket.address();
    } catch (x) {}

    if (remoteAddress) {
      // All-or-nothing
      connection.remoteAddress = remoteAddress;
      connection.remotePort = remotePort;
      connection.address = address;
    }

    connection.url = req.url;
    connection.pathname = req.pathname;
    connection.protocol = recv.protocol;

    let headers = {};
    const allowedHeaders = ['referer', 'x-client-ip', 'x-forwarded-for',
    'x-cluster-client-ip', 'via', 'x-real-ip', 'x-forwarded-proto',
    'x-ssl', 'host', 'user-agent', 'accept-language'];
    for (const key of allowedHeaders) {
      if (req.headers[key]) { headers[key] = req.headers[key]; }
    }

    if (headers) {
      connection.headers = headers;
    }
  }

  unregister() {
    let delay = this.recv.delay_disconnect;
    this.recv.session = null;
    this.recv = null;
    if (this.to_tref) {
      clearTimeout(this.to_tref);
    }

    if (delay) {
      this.to_tref = setTimeout(this.timeout_cb, this.disconnect_delay);
    } else {
      this.timeout_cb();
    }
  }

  flushToRecv(recv) {
    if (this.send_buffer.length > 0) {
      const sb = this.send_buffer;
      this.send_buffer = [];
      recv.doSendBulk(sb);
      return true;
    }
    return false;
  }

  tryFlush() {
    if (!this.flushToRecv(this.recv) || !this.to_tref) {
      if (this.to_tref) {
        clearTimeout(this.to_tref);
      }
      let x = () => {
        if (this.recv) {
          this.to_tref = setTimeout(x, this.heartbeat_delay);
          this.recv.heartbeat();
        }
      };
      this.to_tref = setTimeout(x, this.heartbeat_delay);
    }
  }

  didTimeout() {
    if (this.to_tref) {
      clearTimeout(this.to_tref);
      this.to_tref = null;
    }
    if (this.readyState !== Transport.CONNECTING &&
      this.readyState !== Transport.OPEN &&
      this.readyState !== Transport.CLOSING) {
      throw new Error('INVALID_STATE_ERR');
    }
    if (this.recv) {
      throw new Error('RECV_STILL_THERE');
    }
    this.readyState = Transport.CLOSED;
    this.connection.push(null);
    this.connection = null;
    if (this.session_id) {
      delete MAP[this.session_id];
      return this.session_id = null;
    }
  }

  didMessage(payload) {
    if (this.readyState === Transport.OPEN) {
      this.connection.push(payload);
    }
  }

  send(payload) {
    if (this.readyState !== Transport.OPEN) {
      return false;
    }
    this.send_buffer.push(payload);
    if (this.recv) {
      this.tryFlush();
    }
    return true;
  }

  close(status=1000, reason='Normal closure') {
    if (this.readyState !== Transport.OPEN) {
      return false;
    }
    this.readyState = Transport.CLOSING;
    this.close_frame = closeFrame(status, reason);
    if (this.recv) {
      // Go away. doSendFrame can trigger didClose which can
      // trigger unregister. Make sure the @recv is not null.
      this.recv.doSendFrame(this.close_frame);
      if (this.recv) {
        this.recv.didClose();
      }
      if (this.recv) {
        this.unregister();
      }
    }
    return true;
  }
}

module.exports = Session;
