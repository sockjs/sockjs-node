'use strict';
const utils = require('./utils');
const ResponseReceiver = require('./response-receiver');
const Session = require('./session');

class EventSourceReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'eventsource';
  }

  sendFrame(payload) {
    // Beware of leading whitespace
    const data = `data: ${utils.escape_selected(payload, '\r\n\x00')}\r\n\r\n`;
    return super.sendFrame(data);
  }
}

module.exports = {
  eventsource(req, res, data, next) {
    let origin;
    if (!req.headers['origin'] || req.headers['origin'] === 'null') {
      origin = '*';
    } else {
      origin = req.headers['origin'];
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    const headers = req.headers['access-control-request-headers'];
    if (headers) {
      res.setHeader('Access-Control-Allow-Headers', headers);
    }

    res.writeHead(200);
    // Opera needs one more new line at the start.
    res.write('\r\n');

    Session.register(req, this, new EventSourceReceiver(req, res, this.options));
    next();
  }
};
