'use strict';
const crypto = require('crypto');

module.exports.escape_selected = function escape_selected(str, chars) {
  const map = {};
  chars = `%${chars}`;
  Array.prototype.forEach.call(chars, c => map[c] = escape(c));
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
  return crypto.createHash('md5')
    .update(data)
    .digest('hex');
};

module.exports.overshadowListeners = function overshadowListeners(ee, event, handler) {
  // listeners() returns a reference to the internal array of EventEmitter.
  // Make a copy, because we're about the replace the actual listeners.
  const old_listeners = ee.listeners(event).slice(0);

  ee.removeAllListeners(event);
  const new_handler = function() {
    if (handler.apply(this, arguments) !== true) {
      for (const listener of old_listeners) {
        listener.apply(this, arguments);
      }
      return false;
    }
    return true;
  };
  return ee.addListener(event, new_handler);
};


// eslint-disable-next-line no-control-regex
const escapable = /[\x00-\x1f\ud800-\udfff\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufff0-\uffff]/g;

function unroll_lookup(escapable) {
  let unrolled = {};
  let c = Array.from(Array(65536).keys()).map((i) => String.fromCharCode(i));
  escapable.lastIndex = 0;
  c.join('').replace(escapable, a => {
    unrolled[a] = `\\u${(`0000${a.charCodeAt(0).toString(16)}`).slice(-4)}`;
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
