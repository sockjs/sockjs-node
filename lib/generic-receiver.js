'use strict';

const utils = require('./utils');

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
    this.socket.removeListener('close', this.abort);
    this.socket.removeListener('end', this.abort);
    this.socket = null;
  }

  abort() {
    this.delay_disconnect = false;
    this.close();
  }

  close() {
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
