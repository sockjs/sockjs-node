'use strict';

const querystring = require('querystring');

class GenericApp {
  constructor(options, emit) {
    this.options = options;
    this.emit = emit;
  }

  handle_404(req, res) {
    if (res.finished) {
      return;
    }
    res.writeHead(404);
    res.end();
  }

  handle_405(req, res, methods) {
    res.writeHead(405, { 'Allow': methods.join(', ') });
    res.end();
  }

  handle_error(req, res, x) {
    if (res.finished) {
      return;
    }
    if (typeof x === 'object' && 'status' in x) {
      res.writeHead(x.status);
      res.end((x.message || ''));
    } else {
      try {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      } catch (x) {
        this.log('error', `Exception on "${req.method} ${req.url}" in filter "${req.last_fun}":\n${x.stack || x}`);
      }
    }
  }

  log_request(req, res, data, next) {
    const td = Date.now() - req.start_date;
    this.log('info', `${req.method} ${req.url} ${td}ms ${res.finished ? res.statusCode : '(unfinished)'}`);
    next();
  }

  log(severity, line) {
    this.options.log(severity, line);
  }

  h_no_cache(req, res, content, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, max-age=0');
    next();
  }

  _getBody(req, cb) {
    let body = [];
    req.on('data', d => {
      body.push(d);
    });
    req.once('end', () => {
      cb(null, Buffer.concat(body).toString('utf8'));
    });
    req.once('error', cb);
    req.once('close', () => {
      body = null;
    });
  }

  expect_form(req, res, _data, next) {
    this._getBody(req, (err, body) => {
      switch ((req.headers['content-type'] || '').split(';')[0]) {
      case 'application/x-www-form-urlencoded':
        req.body = querystring.parse(body);
        break;
      case 'text/plain':
      case '':
        req.body = body;
        break;
      default:
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        break;
      }
      next();
    });
  }

  expect_xhr(req, res, _data, next) {
    this._getBody(req, (err, body) => {
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
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        break;
      }
      next();
    });
  }
}

module.exports = GenericApp;
