'use strict';

const debug = require('debug')('sockjs:session');
const Transport = require('./transport/transport');
const SockJSConnection = require('./sockjs-connection');

const MAP = new Map();
function closeFrame(status, reason) {
  return `c${JSON.stringify([status, reason])}`;
}

class Session {
  static bySessionId(session_id) {
    if (!session_id) {
      return null;
    }
    return MAP.get(session_id) || null;
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
    debug('static register', req.session);
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
    debug('readyState', 'CONNECTING', this.session_id);
    if (this.session_id) {
      MAP.set(this.session_id, this);
    }
    this.didTimeout = this.didTimeout.bind(this);
    this.to_tref = setTimeout(this.didTimeout, this.disconnect_delay);
    this.connection = new SockJSConnection(this);
    this.emit_open = () => {
      this.emit_open = null;
      server.emit('connection', this.connection);
    };
  }

  get id() {
    return this.session_id;
  }

  register(req, recv) {
    if (this.recv) {
      recv.sendFrame(closeFrame(2010, 'Another connection still open'));
      recv.close();
      return;
    }
    if (this.to_tref) {
      clearTimeout(this.to_tref);
      this.to_tref = null;
    }
    if (this.readyState === Transport.CLOSING) {
      this.flushToRecv(recv);
      recv.sendFrame(this.close_frame);
      recv.close();
      this.to_tref = setTimeout(this.didTimeout, this.disconnect_delay);
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
      this.recv.sendFrame('o');
      this.readyState = Transport.OPEN;
      debug('readyState', 'OPEN', this.session_id);
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
    let socket = recv.socket;
    if (!socket) {
      socket = recv.response.socket;
    }
    // Store the last known address.
    let remoteAddress, remotePort, address;
    try {
      remoteAddress = socket.remoteAddress;
      remotePort = socket.remotePort;
      address = socket.address();
    } catch (x) {
      // intentionally empty
    }

    if (remoteAddress) {
      // All-or-nothing
      connection.remoteAddress = remoteAddress;
      connection.remotePort = remotePort;
      connection.address = address;
    }

    connection.url = req.url;
    connection.pathname = req.pathname;
    connection.protocol = recv.protocol;

    const headers = {};
    const allowedHeaders = [
      'referer',
      'x-client-ip',
      'x-forwarded-for',
      'x-cluster-client-ip',
      'via',
      'x-real-ip',
      'x-forwarded-proto',
      'x-ssl',
      'dnt',
      'host',
      'user-agent',
      'accept-language',
      'origin'
    ];
    for (const key of allowedHeaders) {
      if (req.headers[key]) {
        headers[key] = req.headers[key];
      }
    }

    if (headers) {
      connection.headers = headers;
    }
  }

  unregister() {
    debug('unregister', this.session_id);
    const delay = this.recv.delay_disconnect;
    this.recv.session = null;
    this.recv = null;
    if (this.to_tref) {
      clearTimeout(this.to_tref);
    }

    if (delay) {
      debug('delay timeout', this.session_id);
      this.to_tref = setTimeout(this.didTimeout, this.disconnect_delay);
    } else {
      debug('immediate timeout', this.session_id);
      this.didTimeout();
    }
  }

  flushToRecv(recv) {
    if (this.send_buffer.length > 0) {
      const sb = this.send_buffer;
      this.send_buffer = [];
      recv.sendBulk(sb);
      return true;
    }
    return false;
  }

  tryFlush() {
    if (!this.flushToRecv(this.recv) || !this.to_tref) {
      if (this.to_tref) {
        clearTimeout(this.to_tref);
      }
      const x = () => {
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
    if (
      this.readyState !== Transport.CONNECTING &&
      this.readyState !== Transport.OPEN &&
      this.readyState !== Transport.CLOSING
    ) {
      throw new Error('INVALID_STATE_ERR');
    }
    if (this.recv) {
      throw new Error('RECV_STILL_THERE');
    }
    debug('readyState', 'CLOSED', this.session_id);
    this.readyState = Transport.CLOSED;
    this.connection.push(null);
    this.connection = null;
    if (this.session_id) {
      MAP.delete(this.session_id);
      debug('delete session', this.session_id, MAP.size);
      this.session_id = null;
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

  close(status = 1000, reason = 'Normal closure') {
    debug('close', status, reason);
    if (this.readyState !== Transport.OPEN) {
      return false;
    }
    this.readyState = Transport.CLOSING;
    debug('readyState', 'CLOSING', this.session_id);
    this.close_frame = closeFrame(status, reason);
    if (this.recv) {
      // Go away. sendFrame can trigger close which can
      // trigger unregister. Make sure this.recv is not null.
      this.recv.sendFrame(this.close_frame);
      if (this.recv) {
        this.recv.close();
      }
      if (this.recv) {
        this.unregister();
      }
    }
    return true;
  }
}

module.exports = Session;
