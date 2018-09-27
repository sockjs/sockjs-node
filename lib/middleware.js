'use strict';

const FayeWebsocket = require('faye-websocket');
const utils = require('./utils');
const querystring = require('querystring');

module.exports = {
  h_no_cache(req, res, _head, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, max-age=0');
    next();
  },

  h_sid(req, res, _head, next) {
    // Some load balancers do sticky sessions, but only if there is
    // a JSESSIONID cookie. If this cookie isn't yet set, we shall
    // set it to a dummy value. It doesn't really matter what, as
    // session information is usually added by the load balancer.
    req.cookies = utils.parseCookie(req.headers.cookie);
    if (typeof this.options.jsessionid === 'function') {
      // Users can supply a function
      this.options.jsessionid(req, res);
    } else if (this.options.jsessionid) {
      // We need to set it every time, to give the loadbalancer
      // opportunity to attach its own cookies.
      const jsid = req.cookies['JSESSIONID'] || 'dummy';
      res.setHeader('Set-Cookie', `JSESSIONID=${jsid}; path=/`);
    }
    next();
  },

  cache_for(res, duration = 365 * 24 * 60 * 60) {
    res.cache_for = duration;
    const exp = new Date(Date.now() + duration * 1000);
    res.setHeader('Cache-Control', `public, max-age=${duration}`);
    res.setHeader('Expires', exp.toGMTString());
  },

  log_request(req, res, _head, next) {
    const td = Date.now() - req.start_date;
    this.options.log(
      'info',
      `${req.method} ${req.url} ${td}ms ${res.finished ? res.statusCode : '(unfinished)'}`
    );
    next();
  },

  expect_form(req, res, _head, next) {
    utils.getBody(req, (err, body) => {
      if (err) {
        return next(err);
      }

      switch ((req.headers['content-type'] || '').split(';')[0]) {
        case 'application/x-www-form-urlencoded':
          req.body = querystring.parse(body);
          break;
        case 'text/plain':
        case '':
          req.body = body;
          break;
        default:
          this.options.log('error', `Unsupported content-type ${req.headers['content-type']}`);
          break;
      }
      next();
    });
  },

  expect_xhr(req, res, _head, next) {
    utils.getBody(req, (err, body) => {
      if (err) {
        return next(err);
      }

      switch ((req.headers['content-type'] || '').split(';')[0]) {
        case 'text/plain':
        case 'T':
        case 'application/json':
        case 'application/xml':
        case '':
        case 'text/xml':
          req.body = body;
          break;
        default:
          this.options.log('error', `Unsupported content-type ${req.headers['content-type']}`);
          break;
      }
      next();
    });
  },

  websocket_check(req, _socket, _head, next) {
    if (!FayeWebsocket.isWebSocket(req)) {
      return next({
        status: 400,
        message: 'Not a valid websocket request'
      });
    }
    next();
  },

  xhr_options(req, res, _head, next) {
    res.statusCode = 204; // No content
    module.exports.cache_for(res);
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Max-Age', res.cache_for);
    res.end();
    next();
  },

  xhr_cors(req, res, _head, next) {
    if (this.options.disable_cors) {
      return next();
    }

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
    next();
  }
};
