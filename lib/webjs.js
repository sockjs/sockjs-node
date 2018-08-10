'use strict';

const debug = require('debug')('sockjs:webjs');
const url = require('url');
const http = require('http');

function execute_async_request(app, funs, req, res, head) {
  function next(err) {
    if (err) {
      if (err.status) {
        const handlerName = `handle_${err.status}`;
        if (app[handlerName]) {
          return app[handlerName](req, res, err);
        }
      }
      return app.handle_error(req, res, err);
    }
    if (!funs.length) {
      return;
    }
    const fun = funs.shift();
    debug('call', fun);
    app[fun](req, res, head, next);
  }
  next();
}

// used in case of 'upgrade' requests where res is
// net.Socket instead of http.ServerResponse
function fake_response(req, res) {
  // This is quite simplistic, don't expect much.
  const headers = { 'Connection': 'close' };
  res.writeHead = function(status, user_headers = {}) {
    let r = [];
    r.push(`HTTP/${req.httpVersion} ${status} ${http.STATUS_CODES[status]}`);
    Object.assign(headers, user_headers);
    for (const k in headers) {
      r.push(`${k}: ${headers[k]}`);
    }
    r.push('');
    r.push('');
    try {
      res.end(r.join('\r\n'));
    } catch (x) {
      // intentionally empty
    }
  };
  res.setHeader = (k, v) => headers[k] = v;
}

module.exports.generateHandler = function generateHandler(app, dispatcher) {
  return function(req, res, head) {
    if (res.writeHead === undefined) {
      fake_response(req, res);
    }
    const parsedUrl = url.parse(req.url, true);
    req.pathname = parsedUrl.pathname || '';
    req.query = parsedUrl.query;
    req.start_date = Date.now();

    let found = false;
    const allowed_methods = [];
    for (const row of dispatcher) {
      let [method, path, funs] = row;
      if (!Array.isArray(path)) {
        path = [path];
      }
      // path[0] must be a regexp
      const m = req.pathname.match(path[0]);
      if (!m) {
        continue;
      }
      if (req.method !== method) {
        allowed_methods.push(method);
        continue;
      }
      for (let i = 1; i < path.length; i++) {
        req[path[i]] = m[i];
      }
      funs = funs.slice(0);
      funs.push('log_request');
      execute_async_request(app, funs, req, res, head);
      found = true;
      break;
    }

    if (!found) {
      if (allowed_methods.length !== 0) {
        app.handle_405(req, res, allowed_methods);
      } else {
        app.handle_404(req, res);
      }
      app.log_request(req, res, true, () => {});
    }
  };
};
