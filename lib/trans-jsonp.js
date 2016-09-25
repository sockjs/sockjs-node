'use strict';
const ResponseReceiver = require('./response-receiver');
const Session = require('./session');

class JsonpReceiver extends ResponseReceiver {
  constructor(req, res, options, callback) {
    super(req, res, options);
    this.protocol = 'jsonp-polling';
    this.max_response_size = 1;
    this.callback = callback;
  }

  doSendFrame(payload) {
    // Yes, JSONed twice, there isn't a a better way, we must pass
    // a string back, and the script, will be evaled() by the
    // browser.
    // prepend comment to avoid SWF exploit #163
    return super.doSendFrame(`/**/${this.callback}(${JSON.stringify(payload)});\r\n`);
  }
}

module.exports = {
  jsonp(req, res) {
    if (!('c' in req.query || 'callback' in req.query)) {
      throw ({
        status: 500,
        message: '"callback" parameter required'
      });
    }

    const callback = 'c' in req.query ? req.query['c'] : req.query['callback'];
    if (/[^a-zA-Z0-9-_.]/.test(callback) || callback.length > 32) {
      throw ({
        status: 500,
        message: 'invalid "callback" parameter'
      });
    }

    // protect against SWF JSONP exploit - #163
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.writeHead(200);

    Session.register(req, this, new JsonpReceiver(req, res, this.options, callback));
    return true;
  },

  jsonp_send(req, res, query) {
    if (!query) {
      throw ({
        status: 500,
        message: 'Payload expected.'
      });
    }
    let d;
    if (typeof query === 'string') {
      try {
        d = JSON.parse(query);
      } catch (x) {
        throw ({
          status: 500,
          message: 'Broken JSON encoding.'
        });
      }
    } else {
      d = query.d;
    }
    if (typeof d === 'string' && d) {
      try {
        d = JSON.parse(d);
      } catch (x) {
        throw ({
          status: 500,
          message: 'Broken JSON encoding.'
        });
      }
    }

    if (!d || d.__proto__.constructor !== Array) {
      throw ({
        status: 500,
        message: 'Payload expected.'
      });
    }
    const jsonp = Session.bySessionId(req.session);
    if (jsonp === null) {
      throw ({status: 404});
    }
    for (const message of d) {
      jsonp.didMessage(message);
    }

    res.setHeader('Content-Length', '2');
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(200);
    res.end('ok');
    return true;
  }
};
