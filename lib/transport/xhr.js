'use strict';

const Session = require('../session');

module.exports = {
  xhr_send(req, res, _head, next) {
    if (!req.body) {
      return next({
        status: 500,
        message: 'Payload expected.'
      });
    }
    let d;
    try {
      d = JSON.parse(req.body);
    } catch (x) {
      return next({
        status: 500,
        message: 'Broken JSON encoding.'
      });
    }
  
    if (!d || d.__proto__.constructor !== Array) {
      return next({
        status: 500,
        message: 'Payload expected.'
      });
    }
    const jsonp = Session.bySessionId(req.session);
    if (!jsonp) {
      return next({ status: 404 });
    }
    for (const message of d) {
      jsonp.didMessage(message);
    }
  
    // FF assumes that the response is XML.
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.writeHead(204);
    res.end();
  }
};
