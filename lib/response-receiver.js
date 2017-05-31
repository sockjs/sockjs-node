'use strict';

const GenericReceiver = require('./generic-receiver');

// Write stuff to response, using chunked encoding if possible.
class ResponseReceiver extends GenericReceiver {
  constructor(request, response, options) {
    super(request.socket);
    this.max_response_size = options.response_limit;
    this.delay_disconnect = true;
    this.request = request;
    this.response = response;
    this.options = options;
    this.curr_response_size = 0;
    try {
      this.request.socket.setKeepAlive(true, 5000);
    } catch (x) {
      // intentionally empty
    }
  }

  sendFrame(payload) {
    this.curr_response_size += payload.length;
    let r = false;
    try {
      this.response.write(payload);
      r = true;
    } catch (x) {
      // intentionally empty
    }
    if (this.max_response_size && this.curr_response_size >= this.max_response_size) {
      this.close();
    }
    return r;
  }

  close() {
    super.close(...arguments);
    try {
      this.response.end();
    } catch (x) {
      // intentionally empty
    }
    this.request = null;
    this.response = null;
  }
}

module.exports = ResponseReceiver;
