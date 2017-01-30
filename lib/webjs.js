'use strict';
const url = require('url');
const http = require('http');

function execute_request(app, funs, req, res, data) {
  try {
    while (funs.length > 0) {
      const fun = funs.shift();
      req.last_fun = fun;
      data = app[fun](req, res, data, req.next_filter);
    }
  } catch (x) {
    if (typeof x === 'object' && 'status' in x) {
      if (x.status === 0) {
        return;
      } else if ((`handle_${x.status}`) in app) {
        app[`handle_${x.status}`](req, res, x);
      } else {
        app['handle_error'](req, res, x);
      }
    } else {
      app['handle_error'](req, res, x);
    }
    app.log_request(req, res, true);
  }
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
    // FIXME this makes it hard to track what is used
    Object.assign(req, url.parse(req.url, true));
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
      if (!req.method.match(new RegExp(method))) {
        allowed_methods.push(method);
        continue;
      }
      for (let i = 1; i < path.length; i++) {
        req[path[i]] = m[i];
      }
      funs = funs.slice(0);
      funs.push('log_request');
      req.next_filter = data => execute_request(app, funs, req, res, data);
      req.next_filter(head);
      found = true;
      break;
    }

    if (!found) {
      if (allowed_methods.length !== 0) {
        app.handle_405(req, res, allowed_methods);
      } else {
        app.handle_404(req, res);
      }
      app.log_request(req, res, true);
    }
  };
};
