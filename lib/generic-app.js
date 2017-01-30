'use strict';

const fs = require('fs');
const querystring = require('querystring');

class GenericApp {
  constructor(options, emit) {
    this.options = options;
    this.emit = emit;
  }

  handle_404(req, res, x) {
    if (res.finished) {
      return x;
    }
    res.writeHead(404);
    res.end();
    return true;
  }

  handle_405(req, res, methods) {
    res.writeHead(405, { 'Allow': methods.join(', ') });
    res.end();
    return true;
  }

  handle_error(req, res, x) {
    if (res.finished) {
      return x;
    }
    if (typeof x === 'object' && 'status' in x) {
      res.writeHead(x.status);
      res.end((x.message || ''));
    } else {
      try {
        res.writeHead(500);
        res.end('500 - Internal Server Error');
      } catch (x) {
        this.log('error', `Exception on "${req.method} ${req.href}" in filter "${req.last_fun}":\n${x.stack || x}`);
      }
    }
    return true;
  }

  log_request(req, res, data) {
    const td = Date.now() - req.start_date;
    this.log('info', `${req.method} ${req.url} ${td}ms ${res.finished ? res.statusCode : '(unfinished)'}`);
    return data;
  }

  log(severity, line) {
    this.options.log(severity, line);
  }

  expose_html(req, res, content) {
    if (res.finished) {
      return content;
    }
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    }
    return this.expose(req, res, content);
  }

  expose_json(req, res, content) {
    if (res.finished) {
      return content;
    }
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    return this.expose(req, res, JSON.stringify(content));
  }

  expose(req, res, content) {
    if (res.finished) {
      return content;
    }
    if (content && !res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'text/plain');
    }
    if (content) {
      res.setHeader('Content-Length', Buffer.byteLength(content));
    }
    res.end(content, 'utf8');
    return true;
  }

  serve_file(req, res, filename, next_filter) {
    const a = function(error, content) {
      if (error) {
        res.writeHead(500);
        res.end("can't read file");
      } else {
        res.setHeader('Content-Length', Buffer.byteLength(content));
        res.end(content, 'utf8');
      }
      return next_filter(true);
    };
    fs.readFile(filename, a);
    throw ({status:0});
  }

  cache_for(req, res, content) {
    res.cache_for = res.cache_for || (365 * 24 * 60 * 60); // one year.
    // See: http://code.google.com/speed/page-speed/docs/caching.html
    res.setHeader('Cache-Control', `public, max-age=${res.cache_for}`);
    const exp = new Date();
    exp.setTime(exp.getTime() + (res.cache_for * 1000));
    res.setHeader('Expires', exp.toGMTString());
    return content;
  }

  h_no_cache(req, res, content) {
    res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, max-age=0');
    return content;
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

  expect_form(req, res, _data, next_filter) {
    this._getBody(req, (err, body) => {
      let q;
      switch ((req.headers['content-type'] || '').split(';')[0]) {
      case 'application/x-www-form-urlencoded':
        q = querystring.parse(body);
        break;
      case 'text/plain':
      case '':
        q = body;
        break;
      default:
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        q = undefined;
        break;
      }
      next_filter(q);
    });
    throw ({ status: 0 });
  }

  expect_xhr(req, res, _data, next_filter) {
    this._getBody(req, (err, body) => {
      let q;
      switch ((req.headers['content-type'] || '').split(';')[0]) {
      case 'text/plain':
      case 'T':
      case 'application/json':
      case 'application/xml':
      case '':
      case 'text/xml':
        q = body;
        break;
      default:
        this.log('error', `Unsupported content-type ${req.headers['content-type']}`);
        q = undefined;
        break;
      }
      next_filter(q);
    });
    throw ({ status: 0 });
  }
}

module.exports = GenericApp;
