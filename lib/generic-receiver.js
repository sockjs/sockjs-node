'use strict';

const utils = require('./utils');
const debug = require('debug')('sockjs:generic-receiver');

class GenericReceiver {
  constructor(socket) {
    this.abort = this.abort.bind(this);
    this.socket = socket;
    this.socket.on('close', this.abort);
    this.socket.on('end', this.abort);
  }

  tearDown() {
    if (!this.socket) {
      return;
    }
    debug('tearDown', this.session && this.session.id);
    this.socket.removeListener('close', this.abort);
    this.socket.removeListener('end', this.abort);
    this.socket = null;
  }

  abort() {
    debug('abort', this.session && this.session.id);
    this.delay_disconnect = false;
    this.close();
  }

  close() {
    debug('close', this.session && this.session.id);
    this.tearDown();
    if (this.session) {
      this.session.unregister();
    }
  }

  sendBulk(messages) {
    const q_msgs = messages.map(m => utils.quote(m)).join(',');
    return this.sendFrame(`a[${q_msgs}]`);
  }

  heartbeat() {
    return this.sendFrame('h');
  }
}

module.exports = GenericReceiver;
