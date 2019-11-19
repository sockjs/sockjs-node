'use strict';
const crypto = require('crypto');
const http = require('http');

// used in case of 'upgrade' requests where res is
// net.Socket instead of http.ServerResponse
module.exports.fake_response = function fake_response(req, res) {
  // This is quite simplistic, don't expect much.
  const headers = { Connection: 'close' };
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
      res.write(r.join('\r\n'));
    } catch (x) {
      // intentionally empty
    }
  };
  res.setHeader = (k, v) => (headers[k] = v);
};

module.exports.escape_selected = function escape_selected(str, chars) {
  const map = {};
  chars = `%${chars}`;
  Array.prototype.forEach.call(chars, c => (map[c] = escape(c)));
  const r = new RegExp(`([${chars}])`);
  const parts = str.split(r);
  parts.forEach((v, i) => {
    if (v.length === 1 && v in map) {
      parts[i] = map[v];
    }
  });
  return parts.join('');
};

module.exports.md5_hex = function md5_hex(data) {
  return crypto
    .createHash('md5')
    .update(data)
    .digest('hex');
};

// eslint-disable-next-line no-control-regex
const escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g;

function unroll_lookup(escapable) {
  const unrolled = {};
  const c = Array.from(Array(65536).keys()).map(i => String.fromCharCode(i));
  escapable.lastIndex = 0;
  c.join('').replace(escapable, a => {
    unrolled[a] = `\\u${`0000${a.charCodeAt(0).toString(16)}`.slice(-4)}`;
  });
  return unrolled;
}

const lookup = unroll_lookup(escapable);

module.exports.quote = function quote(string) {
  const quoted = JSON.stringify(string);

  // In most cases normal json encoding fast and enough
  escapable.lastIndex = 0;
  if (!escapable.test(quoted)) {
    return quoted;
  }

  return quoted.replace(escapable, a => lookup[a]);
};

module.exports.parseCookie = function parseCookie(cookie_header) {
  const cookies = {};
  if (cookie_header) {
    cookie_header.split(';').forEach(cookie => {
      const [name, value] = cookie.split('=');
      cookies[name.trim()] = (value || '').trim();
    });
  }
  return cookies;
};

module.exports.random32 = function random32() {
  return crypto.randomBytes(4).readUInt32LE(0);
};

module.exports.getBody = function getBody(req, cb) {
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
};
