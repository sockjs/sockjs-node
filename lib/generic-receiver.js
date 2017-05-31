'use strict';

const utils = require('./utils');

class GenericReceiver {
  constructor(socket) {
    this.socket = socket;
    this.abort = this.abort.bind(this);
    this.socket.on('close', this.abort);
    this.socket.on('end', this.abort);
  }

  tearDown() {
    this.socket.removeListener('close', this.abort);
    this.socket.removeListener('end', this.abort);
  }

  abort() {
    this.delay_disconnect = false;
    this.close();
  }

  close() {
    if (this.socket) {
      this.tearDown();
      this.socket = null;
    }
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
