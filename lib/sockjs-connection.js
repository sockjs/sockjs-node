'use strict';

const debug = require('debug')('sockjs:connection');
const stream = require('stream');
const uuid = require('uuid');

class SockJSConnection extends stream.Duplex {
  constructor(session) {
    super({ decodeStrings: false, encoding: 'utf8' });
    this._session = session;
    this.id = uuid.v4();
    this.headers = {};
    this.prefix = this._session.prefix;
    debug('new connection', this.id, this.prefix);
  }

  toString() {
    return `<SockJSConnection ${this.id}>`;
  }

  _write(chunk, encoding, callback) {
    if (Buffer.isBuffer(chunk)) {
      chunk = chunk.toString();
    }
    this._session.send(chunk);
    callback();
  }

  _read() {
  }

  end(chunk, encoding, callback) {
    super.end(chunk, encoding, callback);
    this.close();
  }

  close(code, reason) {
    debug('close', code, reason);
    return this._session.close(code, reason);
  }

  get readyState() {
    return this._session.readyState;
  }
}

module.exports = SockJSConnection;
