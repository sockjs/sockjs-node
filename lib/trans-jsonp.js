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

  sendFrame(payload) {
    // Yes, JSONed twice, there isn't a a better way, we must pass
    // a string back, and the script, will be evaled() by the
    // browser.
    // prepend comment to avoid SWF exploit #163
    return super.sendFrame(`/**/${this.callback}(${JSON.stringify(payload)});\r\n`);
  }
}

module.exports = {
  jsonp(req, res, data, next) {
    if (!('c' in req.query || 'callback' in req.query)) {
      return next({
        status: 500,
        message: '"callback" parameter required'
      });
    }

    const callback = 'c' in req.query ? req.query['c'] : req.query['callback'];
    if (/[^a-zA-Z0-9-_.]/.test(callback) || callback.length > 32) {
      return next({
        status: 500,
        message: 'invalid "callback" parameter'
      });
    }

    // protect against SWF JSONP exploit - #163
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    res.writeHead(200);

    Session.register(req, this, new JsonpReceiver(req, res, this.options, callback));
    next();
  },

  jsonp_send(req, res, query, next) {
    if (!req.body) {
      return next({
        status: 500,
        message: 'Payload expected.'
      });
    }
    let d;
    if (typeof req.body === 'string') {
      try {
        d = JSON.parse(req.body);
      } catch (x) {
        return next({
          status: 500,
          message: 'Broken JSON encoding.'
        });
      }
    } else {
      d = req.body.d;
    }
    if (typeof d === 'string' && d) {
      try {
        d = JSON.parse(d);
      } catch (x) {
        return next({
          status: 500,
          message: 'Broken JSON encoding.'
        });
      }
    }

    if (!d || d.__proto__.constructor !== Array) {
      return next({
        status: 500,
        message: 'Payload expected.'
      });
    }
    const jsonp = Session.bySessionId(req.session);
    if (jsonp === null) {
      return next({ status: 404 });
    }
    for (const message of d) {
      jsonp.didMessage(message);
    }

    res.setHeader('Content-Length', '2');
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(200);
    res.end('ok');
    next();
  }
};
