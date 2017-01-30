'use strict';
const ResponseReceiver = require('./response-receiver');
const Session = require('./session');

class XhrStreamingReceiver extends ResponseReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'xhr-streaming';
  }

  doSendFrame(payload) {
    return super.doSendFrame(payload + '\n');
  }
}

class XhrPollingReceiver extends XhrStreamingReceiver {
  constructor(req, res, options) {
    super(req, res, options);
    this.protocol = 'xhr-polling';
    this.max_response_size = 1;
  }
}

module.exports = {
  xhr_options(req, res) {
    res.statusCode = 204;    // No content
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Max-Age', res.cache_for);
    return '';
  },

  xhr_send(req, res, data) {
    if (!data) {
      throw ({
        status: 500,
        message: 'Payload expected.'
      });
    }
    let d;
    try {
      d = JSON.parse(data);
    } catch (x) {
      throw ({
        status: 500,
        message: 'Broken JSON encoding.'
      });
    }

    if (!d || d.__proto__.constructor !== Array) {
      throw ({
        status: 500,
        message: 'Payload expected.'
      });
    }
    const jsonp = Session.bySessionId(req.session);
    if (!jsonp) {
      throw ({ status: 404 });
    }
    for (const message of d) {
      jsonp.didMessage(message);
    }

    // FF assumes that the response is XML.
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(204);
    res.end();
    return true;
  },

  xhr_cors(req, res, content) {
    let origin;
    if (!req.headers['origin']) {
      origin = '*';
    } else {
      origin = req.headers['origin'];
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    const headers = req.headers['access-control-request-headers'];
    if (headers) {
      res.setHeader('Access-Control-Allow-Headers', headers);
    }
    return content;
  },

  xhr_poll(req, res) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.writeHead(200);

    Session.register(req, this, new XhrPollingReceiver(req, res, this.options));
    return true;
  },

  xhr_streaming(req, res) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.writeHead(200);

    // IE requires 2KB prefix:
    //  http://blogs.msdn.com/b/ieinternals/archive/2010/04/06/comet-streaming-in-internet-explorer-with-xmlhttprequest-and-xdomainrequest.aspx
    res.write(Array(2049).join('h') + '\n');

    Session.register(req, this, new XhrStreamingReceiver(req, res, this.options) );
    return true;
  }
};
