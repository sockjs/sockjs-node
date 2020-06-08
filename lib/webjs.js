'use strict';

const debug = require('debug')('sockjs:webjs');
const url = require('url');
const utils = require('./utils');
const handlers = require('./handlers');
const middleware = require('./middleware');

function execute_async_request(server, funs, req, res, head) {
  function next(err) {
    if (err) {
      if (err.status) {
        const handlerName = `handle_${err.status}`;
        if (handlers[handlerName]) {
          return handlers[handlerName].call(server, req, res, err);
        }
      }
      return handlers.handle_error.call(server, err, req, res);
    }
    if (!funs.length) {
      return;
    }
    const fun = funs.shift();
    debug('call', fun);
    fun.call(server, req, res, head, next);
  }
  next();
}

module.exports.generateHandler = function generateHandler(server, dispatcher) {
  return function (req, res, head) {
    if (res.writeHead === undefined) {
      utils.fake_response(req, res);
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
      funs.push(middleware.log_request);
      execute_async_request(server, funs, req, res, head);
      found = true;
      break;
    }

    if (!found) {
      if (allowed_methods.length !== 0) {
        handlers.handle_405.call(server, req, res, allowed_methods);
      } else {
        handlers.handle_404.call(server, req, res);
      }
      middleware.log_request.call(server, req, res, true, () => {});
    }
  };
};
