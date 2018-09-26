'use strict';

const ResponseReceiver = require('./response-receiver');
const Session = require('../session');

class XhrStreamingReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'xhr-streaming';
  }

  sendFrame(payload) {
    return super.sendFrame(payload + '\n');
  }
}

module.exports = {
  xhr_streaming(req, res, _head, next) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.writeHead(200);

    // IE requires 2KB prefix:
    // http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
    res.write(Array(2049).join('h') + '\n');

    Session.register(req, this, new XhrStreamingReceiver(req, res, this.options) );
    next();
  }
};
