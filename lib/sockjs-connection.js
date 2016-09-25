'use strict';

const debug = require('debug')('sockjs:connection');
const stream = require('stream');
const uuid = require('uuid');

class SockJSConnection extends stream.Duplex {
  constructor(_session) {
    super({ decodeStrings: false, encoding: 'utf8' });
    this._session = _session;
    this.id  = uuid.v4();
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

  end(string) {
    if (string) {
      this.write(string);
    }
    this.close();
    return null;
  }

  close(code, reason) {
    debug('close', code, reason);
    return this._session.close(code, reason);
  }

  destroy() {
    this.end();
    this.removeAllListeners();
  }

  destroySoon() {
    this.destroy();
  }

  get readyState() {
    return this._session.readyState;
  }
}

module.exports = SockJSConnection;
