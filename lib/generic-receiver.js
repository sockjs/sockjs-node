'use strict';

const utils = require('./utils');

class GenericReceiver {
  constructor(thingy) {
    this.thingy = thingy;
    this.thingy_end_cb = () => this.didAbort();
    this.thingy.addListener('close', this.thingy_end_cb);
    this.thingy.addListener('end', this.thingy_end_cb);
  }

  tearDown() {
    this.thingy.removeListener('close', this.thingy_end_cb);
    this.thingy.removeListener('end', this.thingy_end_cb);
    this.thingy_end_cb = null;
  }

  didAbort() {
    this.delay_disconnect = false;
    this.didClose();
  }

  didClose() {
    if (this.thingy) {
      this.tearDown();
      this.thingy = null;
    }
    if (this.session) {
      this.session.unregister();
    }
  }

  doSendBulk(messages) {
    let q_msgs = messages.map(m => utils.quote(m));
    return this.doSendFrame(`a[${q_msgs.join(',')}]`);
  }

  heartbeat() {
    return this.doSendFrame('h');
  }
}

module.exports = GenericReceiver;
