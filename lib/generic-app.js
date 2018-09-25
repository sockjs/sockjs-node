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

  handle_error(err, req, res) {
    if (res.finished) {
      return;
    }
    if (typeof err === 'object' && 'status' in err) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
      res.writeHead(err.status);
      res.end(err.message || '');
    } else {
      try {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      } catch (ex) {
        this.log('error', `Exception on "${req.method} ${req.url}" in filter "${req.last_fun}":\n${ex.stack || ex}`);
      }
    }
  }

  log_request(req, res, _head, next) {
    const td = Date.now() - req.start_date;
    this.log('info', `${req.method} ${req.url} ${td}ms ${res.finished ? res.statusCode : '(unfinished)'}`);
    next();
  }

  log(severity, line) {
    this.options.log(severity, line);
  }

  h_no_cache(req, res, _head, next) {
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

  expect_form(req, res, _head, next) {
    this._getBody(req, (err, body) => {
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
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        break;
      }
      next();
    });
  }

  expect_xhr(req, res, _head, next) {
    this._getBody(req, (err, body) => {
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
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        break;
      }
      next();
    });
  }
}

module.exports = GenericApp;
